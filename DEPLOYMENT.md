# Deploying a MERN Microservices Application on Azure Kubernetes Service (AKS)

**Application:** [SampleMERNwithMicroservices](https://github.com/UnpredictablePrashant/SampleMERNwithMicroservices)
**Platform:** Azure Kubernetes Service (AKS) + Azure Container Registry (ACR)

This document walks through containerising the application, publishing the images to ACR, and running everything on AKS. Every step has a screenshot slot; capture your own screenshot as you go and save it under `docs/screenshots/` using the file name shown (see [`docs/screenshots/README.md`](docs/screenshots/README.md)).

---

## 1. Application overview

| Component | Tech | Port | Role |
|---|---|---|---|
| `frontend` | React (built to static files, served by nginx) | 80 | UI. Also reverse-proxies `/api/*` to the backend services |
| `helloService` | Node.js / Express | 3001 | Returns `{"msg":"Hello World"}`; `/health` endpoint |
| `profileService` | Node.js / Express / Mongoose | 3002 | `POST /addUser`, `GET /fetchUser`; `/health` endpoint. Needs `MONGO_URL` |
| `mongo` | MongoDB 7 | 27017 | Database for `profileService` |

### Target architecture

```
                         Internet
                            |
                 Azure Load Balancer (public IP)
                            |
                  Service: frontend (LoadBalancer :80)
                            |
                  Pods: frontend (nginx + React build)
                     |                       |
         /api/hello/*|                       |/api/profile/*
                     v                       v
      Service: hello-service :3001   Service: profile-service :3002
      Pods: hello-service (x2)       Pods: profile-service (x2)
                                              |
                                              v
                                     Service: mongo :27017
                                     StatefulSet: mongo + Azure Disk (PVC)
```

Only the frontend is exposed publicly. The backends and MongoDB are `ClusterIP`/headless services, reachable only inside the cluster.

### Changes made to the original code

1. **Dockerfiles** added for the three apps (`frontend/`, `backend/helloService/`, `backend/profileService/`). The backends have no `start` script, so the containers run `node index.js`.
2. **`frontend/src/components/Home.js`**: the original called `http://localhost:3001` and `http://localhost:3002`, which cannot work once deployed (the browser's `localhost` is the user's machine). The URLs now come from `REACT_APP_HELLO_URL` / `REACT_APP_PROFILE_URL` and default to `/api/hello` and `/api/profile`. `frontend/.env.development` keeps `npm start` working locally.
3. **`frontend/nginx.conf`** serves the React build and proxies `/api/hello/` and `/api/profile/` to the in-cluster services.
4. **`k8s/`** manifests for the namespace, MongoDB, both backends, and the frontend.

### Repository layout

```
.
├── backend/
│   ├── helloService/     (index.js, Dockerfile)
│   └── profileService/   (index.js, Dockerfile)
├── frontend/             (React source, Dockerfile, nginx.conf)
├── k8s/
│   ├── 00-namespace.yaml
│   ├── 01-mongo.yaml
│   ├── 02-hello-service.yaml
│   ├── 03-profile-service.yaml
│   └── 04-frontend.yaml
├── docs/screenshots/
└── DEPLOYMENT.md         (this file)
```

---

## 2. Prerequisites

- An Azure subscription (a free/student subscription is enough)
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli), `kubectl`, `git`, and `envsubst` (part of `gettext`; already present in Azure Cloud Shell)
- A bash shell. **Azure Cloud Shell (bash)** has everything pre-installed and is the easiest option.
- Docker is **not** required: images are built in Azure with `az acr build`.

---

## 3. Step-by-step deployment

### Step 1: Sign in and choose the subscription

```bash
az login
az account show --output table
```

![Step 1: az login and active subscription](docs/screenshots/01-az-login.png)

### Step 2: Set variables

Pick a globally unique ACR name (lowercase letters and digits only).

```bash
RESOURCE_GROUP=rg-mern-aks
LOCATION=centralindia          # use any region where your subscription has quota
ACR_NAME=mernacr$RANDOM        # must be globally unique
AKS_NAME=aks-mern
```

### Step 3: Create the resource group

```bash
az group create --name $RESOURCE_GROUP --location $LOCATION
```

![Step 3: resource group created](docs/screenshots/02-resource-group.png)

### Step 4: Create Azure Container Registry

```bash
az acr create --resource-group $RESOURCE_GROUP --name $ACR_NAME --sku Basic
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --query loginServer --output tsv)
echo $ACR_LOGIN_SERVER
```

![Step 4: ACR created](docs/screenshots/03-acr-created.png)

### Step 5: Clone this repository

```bash
git clone <YOUR-REPOSITORY-URL> mern-aks
cd mern-aks
```

### Step 6: Build and push the three images with ACR Tasks

`az acr build` uploads the source, builds the image in Azure, and pushes it to the registry in one command.

```bash
az acr build --registry $ACR_NAME --image mern-hello-service:v1   ./backend/helloService
az acr build --registry $ACR_NAME --image mern-profile-service:v1 ./backend/profileService
az acr build --registry $ACR_NAME --image mern-frontend:v1        ./frontend
```

![Step 6: az acr build succeeded](docs/screenshots/04-acr-build.png)

Confirm the repositories exist:

```bash
az acr repository list --name $ACR_NAME --output table
```

![Step 6: repositories listed in ACR](docs/screenshots/05-acr-repositories.png)

### Step 7: Create the AKS cluster

`--attach-acr` grants the cluster permission to pull images from the registry, so no image-pull secrets are needed.

```bash
az aks create \
  --resource-group $RESOURCE_GROUP \
  --name $AKS_NAME \
  --node-count 2 \
  --node-vm-size Standard_B2s \
  --generate-ssh-keys \
  --attach-acr $ACR_NAME
```

This takes about 5 to 10 minutes. If you get a VM-size or quota error, list the sizes available to you with `az vm list-skus --location $LOCATION --resource-type virtualMachines --output table` and re-run with an allowed `--node-vm-size`.

![Step 7: AKS cluster created (Azure portal overview)](docs/screenshots/06-aks-created.png)

### Step 8: Connect `kubectl` to the cluster

```bash
az aks get-credentials --resource-group $RESOURCE_GROUP --name $AKS_NAME
kubectl get nodes
```

Both nodes should show `Ready`.

![Step 8: kubectl get nodes](docs/screenshots/07-kubectl-nodes.png)

### Step 9: Create the namespace and secrets

Passwords are **not** stored in git. They are created directly in the cluster.

```bash
kubectl apply -f k8s/00-namespace.yaml

MONGO_PASSWORD=$(openssl rand -hex 16)

kubectl create secret generic mongo-secret \
  --namespace mern-app \
  --from-literal=MONGO_INITDB_ROOT_USERNAME=admin \
  --from-literal=MONGO_INITDB_ROOT_PASSWORD=$MONGO_PASSWORD

kubectl create secret generic profile-secret \
  --namespace mern-app \
  --from-literal=MONGO_URL="mongodb://admin:${MONGO_PASSWORD}@mongo:27017/profiledb?authSource=admin"

kubectl get secrets --namespace mern-app
```

![Step 9: namespace and secrets](docs/screenshots/08-secrets.png)

### Step 10: Deploy MongoDB

```bash
kubectl apply -f k8s/01-mongo.yaml
kubectl rollout status statefulset/mongo --namespace mern-app
kubectl get pvc --namespace mern-app
```

The `PersistentVolumeClaim` should be `Bound` to an Azure Disk.

![Step 10: MongoDB running with a bound volume](docs/screenshots/09-mongo-running.png)

### Step 11: Deploy the backend services and the frontend

The manifests contain a `${ACR_LOGIN_SERVER}` placeholder for the image names. `envsubst` fills it in; listing the variable name explicitly stops it touching anything else.

```bash
export ACR_LOGIN_SERVER
for f in k8s/02-hello-service.yaml k8s/03-profile-service.yaml k8s/04-frontend.yaml; do
  envsubst '${ACR_LOGIN_SERVER}' < $f | kubectl apply -f -
done

kubectl rollout status deployment/hello-service   --namespace mern-app
kubectl rollout status deployment/profile-service --namespace mern-app
kubectl rollout status deployment/frontend        --namespace mern-app
```

### Step 12: Verify all resources

```bash
kubectl get pods,svc --namespace mern-app
```

All pods should be `Running` and `READY 1/1`.

![Step 12: pods and services](docs/screenshots/10-pods-services.png)

### Step 13: Get the public IP

```bash
kubectl get svc frontend --namespace mern-app --watch
```

Wait until `EXTERNAL-IP` changes from `<pending>` to an address, then press Ctrl+C.

![Step 13: external IP assigned](docs/screenshots/11-external-ip.png)

```bash
EXTERNAL_IP=$(kubectl get svc frontend --namespace mern-app --output jsonpath='{.status.loadBalancer.ingress[0].ip}')
echo http://$EXTERNAL_IP
```

### Step 14: Open the application

Browse to `http://<EXTERNAL-IP>`. The page shows the **Hello World** message from `helloService`, and an empty Profile list from `profileService`.

![Step 14: application in the browser](docs/screenshots/12-app-browser.png)

### Step 15: Add data and confirm the database works

```bash
curl -X POST http://$EXTERNAL_IP/api/profile/addUser \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","age":25}'

curl http://$EXTERNAL_IP/api/profile/fetchUser
```

![Step 15: POST and GET against the API](docs/screenshots/13-api-test.png)

Refresh the browser. The new user now appears under **Profile**, proving the full path works: browser, frontend, profile service, MongoDB.

![Step 15: data shown in the browser](docs/screenshots/14-app-with-data.png)

### Step 16: Check logs (optional)

```bash
kubectl logs deployment/profile-service --namespace mern-app
```

![Step 16: profile-service logs](docs/screenshots/15-logs.png)

---

## 4. Day-2 operations

**Scale a service**

```bash
kubectl scale deployment/hello-service --replicas=3 --namespace mern-app
```

**Roll out a new version.** Build a new tag, then update the deployment:

```bash
az acr build --registry $ACR_NAME --image mern-frontend:v2 ./frontend
kubectl set image deployment/frontend frontend=$ACR_LOGIN_SERVER/mern-frontend:v2 --namespace mern-app
kubectl rollout status deployment/frontend --namespace mern-app
```

**Roll back**

```bash
kubectl rollout undo deployment/frontend --namespace mern-app
```

---

## 5. Troubleshooting

| Symptom | Likely cause | What to check |
|---|---|---|
| Pod in `ImagePullBackOff` | Cluster cannot pull from ACR, or wrong image name | `kubectl describe pod <pod> -n mern-app`; confirm the cluster was created with `--attach-acr`, or run `az aks update -g $RESOURCE_GROUP -n $AKS_NAME --attach-acr $ACR_NAME` |
| Image name shows `${ACR_LOGIN_SERVER}/...` | Manifest applied without `envsubst` | Re-run Step 11 |
| `profile-service` in `CrashLoopBackOff` | Cannot reach or authenticate to MongoDB | `kubectl logs deployment/profile-service -n mern-app`; confirm the `mongo-0` pod is `Running` and the secrets exist |
| `mongo-0` stuck in `Pending` | Volume not provisioned | `kubectl describe pvc -n mern-app`; confirm the `managed-csi` storage class exists (`kubectl get storageclass`) |
| `EXTERNAL-IP` stays `<pending>` | Load balancer still being created | Wait a few minutes; `kubectl describe svc frontend -n mern-app` |
| Page loads but Profile is empty / API errors | Backend not reachable from nginx | `kubectl logs deployment/frontend -n mern-app`; check both backend services have endpoints: `kubectl get endpoints -n mern-app` |
| `frontend` pod restarts with "host not found in upstream" | Frontend started before the backend Services existed | Apply Step 11 files together as shown, or `kubectl rollout restart deployment/frontend -n mern-app` |

---

## 6. Notes and limitations

- **MongoDB runs inside the cluster as a single replica.** That is appropriate for this assignment; for production you would use a managed database (Azure Cosmos DB for MongoDB or MongoDB Atlas) and point `MONGO_URL` at it.
- **The site is served over plain HTTP** on the load balancer's public IP. For HTTPS you would add an ingress controller with a certificate and a DNS name.
- Images use a fixed `v1` tag for clarity; in a real pipeline each build would get a unique tag (for example the git commit SHA).

---

## 7. Clean up

Deleting the resource group removes the cluster, registry, disks, and load balancer, so nothing keeps billing.

```bash
az group delete --name $RESOURCE_GROUP --yes --no-wait
```

---

## 8. Running locally (without Kubernetes)

```bash
# helloService
cd backend/helloService && npm install && PORT=3001 node index.js

# profileService (needs a MongoDB instance)
cd backend/profileService && npm install
PORT=3002 MONGO_URL="mongodb://localhost:27017/profiledb" node index.js

# frontend
cd frontend && npm install && npm start
```
