# MERN microservices on Azure Kubernetes Service

A cloud deployment practice assignment using a React frontend, two Node.js services and MongoDB. The application is based on [UnpredictablePrashant/SampleMERNwithMicroservices](https://github.com/UnpredictablePrashant/SampleMERNwithMicroservices). The portfolio focus is containerization and Kubernetes deployment configuration.

## Architecture

```text
Public LoadBalancer :80 -> frontend (React + Nginx)
                          /api/hello/   -> hello-service :3001
                          /api/profile/ -> profile-service :3002 -> mongo :27017

MongoDB: single-replica StatefulSet + managed-csi persistent volume
```

The frontend and both backend Deployments request two replicas each. Backend services use ClusterIP; MongoDB uses a headless service. Each workload declares probes and resource requests/limits. The frontend is the only public service defined by these manifests.

## Repository map

| Path | Purpose |
| --- | --- |
| `frontend/` | React source, container build and Nginx API routing |
| `backend/helloService/` | Hello API and Dockerfile |
| `backend/profileService/` | Profile API, MongoDB connection and Dockerfile |
| `k8s/00-namespace.yaml` | `mern-app` namespace |
| `k8s/01-mongo.yaml` | MongoDB StatefulSet, service and persistent storage |
| `k8s/02-hello-service.yaml` | Hello Deployment and service |
| `k8s/03-profile-service.yaml` | Profile Deployment and service |
| `k8s/04-frontend.yaml` | Frontend Deployment and public service |
| `DEPLOYMENT.md` | Extended ACR/AKS walkthrough and troubleshooting |

## Status and scope

Dockerfiles, application source and Kubernetes manifests are available. This README does not claim a newly verified AKS deployment, availability result or performance measurement. The repository contains a screenshot document; individual PNG links in the older deployment guide include evidence placeholders and should not be treated as completed validation.

## Deploy a lab

Use a Bash environment with Git, Azure CLI, kubectl, envsubst and an authenticated Azure subscription. Provision an ACR registry and AKS cluster with suitable quota, image-pull permissions and a compatible `managed-csi` storage class, following [DEPLOYMENT.md](DEPLOYMENT.md). Use the actual repository URL:

```bash
git clone https://github.com/thupeshkumar/mern-aks.git
cd mern-aks
```

Set `ACR_NAME` to your registry name, then build the images:

```bash
az acr build --registry "$ACR_NAME" --image mern-hello-service:v1 ./backend/helloService
az acr build --registry "$ACR_NAME" --image mern-profile-service:v1 ./backend/profileService
az acr build --registry "$ACR_NAME" --image mern-frontend:v1 ./frontend
export ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer --output tsv)
```

Confirm the intended kubectl context. Apply `k8s/00-namespace.yaml`, then create `mongo-secret` and `profile-secret` as described in the deployment guide. Required secret keys are `MONGO_INITDB_ROOT_USERNAME`, `MONGO_INITDB_ROOT_PASSWORD` and `MONGO_URL`. Keep values out of Git and screenshots.

```bash
kubectl apply -f k8s/01-mongo.yaml
kubectl rollout status statefulset/mongo -n mern-app
for f in k8s/02-hello-service.yaml k8s/03-profile-service.yaml k8s/04-frontend.yaml; do
  envsubst '${ACR_LOGIN_SERVER}' < "$f" | kubectl apply -f -
done
kubectl rollout status deployment/hello-service -n mern-app
kubectl rollout status deployment/profile-service -n mern-app
kubectl rollout status deployment/frontend -n mern-app
kubectl get pods,svc,pvc -n mern-app
```

Do not apply image placeholders literally. Inspect rendered manifests when troubleshooting image-pull failures.

## Validate application behavior

```bash
EXTERNAL_IP=$(kubectl get svc frontend -n mern-app -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
curl --fail "http://$EXTERNAL_IP/api/hello/health"
curl --fail "http://$EXTERNAL_IP/api/profile/health"
curl --fail -X POST "http://$EXTERNAL_IP/api/profile/addUser" \
  -H 'Content-Type: application/json' -d '{"name":"Portfolio Test","age":25}'
curl --fail "http://$EXTERNAL_IP/api/profile/fetchUser"
```

Verify the UI, API response and stored test record. Inspect logs with `kubectl logs deployment/profile-service -n mern-app`; use `kubectl describe pod` and `kubectl describe pvc` for scheduling, pull or storage errors. Record actual results against a commit instead of treating the expected output as evidence.

## Operational limits

- MongoDB is a single replica; application replica counts do not make the database highly available.
- The public entry point uses HTTP. TLS/ingress, network policies, backups and recovery tests need additional work.
- The documented lab connection uses a MongoDB administrator credential for the application. Use a database-scoped application identity before expanding the setup.
- Kubernetes Secrets are referenced by the manifests; that alone does not establish encryption at rest or a complete secrets-management design.
- Image tags use `v1`; immutable versioning and a tested CI/CD release workflow are future improvements, not implemented claims.

The deployment guide includes manual scaling, image updates and rollout rollback commands. Exercise them only on the intended lab and record the observed result.

## Cleanup

For application removal, inspect the `mern-app` namespace and back up required data before deleting it. Cluster, registry and related Azure resources can remain billable. Delete a resource group only after confirming it is dedicated to this lab, and verify the final Azure resource inventory. Review persistent-volume reclaim behavior before removing storage.
