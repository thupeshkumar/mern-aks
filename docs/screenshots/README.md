# Screenshots

Save one screenshot per step in this folder using **exactly** these file names, so the images appear in `DEPLOYMENT.md`.

| File name | What to capture |
|---|---|
| `01-az-login.png` | `az login` succeeded and `az account show` output |
| `02-resource-group.png` | `az group create` output (or the resource group in the portal) |
| `03-acr-created.png` | `az acr create` output / ACR overview in the portal |
| `04-acr-build.png` | The end of an `az acr build` run showing it succeeded |
| `05-acr-repositories.png` | `az acr repository list` showing the three repositories |
| `06-aks-created.png` | AKS cluster overview in the Azure portal (status: Succeeded / Running) |
| `07-kubectl-nodes.png` | `kubectl get nodes` with nodes `Ready` |
| `08-secrets.png` | `kubectl get secrets -n mern-app` (do **not** show secret values) |
| `09-mongo-running.png` | `kubectl rollout status` for mongo and `kubectl get pvc` showing `Bound` |
| `10-pods-services.png` | `kubectl get pods,svc -n mern-app` with all pods `Running` |
| `11-external-ip.png` | `kubectl get svc frontend -n mern-app` showing the `EXTERNAL-IP` |
| `12-app-browser.png` | The app open in the browser at the external IP, address bar visible |
| `13-api-test.png` | The `curl` POST and GET to `/api/profile/...` and their responses |
| `14-app-with-data.png` | The app in the browser showing the added user |
| `15-logs.png` | `kubectl logs deployment/profile-service -n mern-app` |

Tip: do not include your MongoDB password or subscription ID in any screenshot.
