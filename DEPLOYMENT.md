# Deployment Guide

## Prerequisites
- Docker and Docker Compose installed on the Azure VM
- Git installed on the Azure VM
- Azure VM with ports 80 (HTTP) and 8000 opened in the Network Security Group

## Deployment Steps

1. Clone the repository on the Azure VM:
```bash
git clone <your-repository-url>
cd algo-integration
```

2. Build and start the containers:
```bash
docker-compose up -d --build
```

3. Verify the deployment:
- Backend API should be accessible at `http://<your-vm-ip>:8000`
- Frontend should be accessible at `http://<your-vm-ip>`

## Monitoring and Maintenance

### View logs
```bash
# View all logs
docker-compose logs

# View specific service logs
docker-compose logs backend
docker-compose logs frontend
```

### Update the deployment
1. Pull the latest changes:
```bash
git pull origin main
```

2. Rebuild and restart the containers:
```bash
docker-compose down
docker-compose up -d --build
```

### Backup
- Regular backups of any persistent data should be configured
- Consider using Azure Backup for VM-level protection

## Security Considerations
- Set up SSL/TLS certificates for HTTPS
- Configure proper firewall rules
- Keep Docker and all dependencies updated
- Use environment variables for sensitive information
- Regularly update security patches

## Scaling
- Consider using Azure Container Instances or Azure Kubernetes Service for better scaling
- Monitor resource usage and adjust VM size as needed
