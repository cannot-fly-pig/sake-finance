# Sake Finance Subgraph - Deployment Guide

Soneium is not yet supported by The Graph Studio. You need to run a local Graph Node to index this subgraph.

## Prerequisites

- Docker and Docker Compose
- Node.js and npm

## Option 1: Local Graph Node (Recommended for Development)

### 1. Start Graph Node Infrastructure

```bash
# Start Graph Node, IPFS, and PostgreSQL
docker-compose up -d

# Check logs
docker-compose logs -f graph-node
```

Wait for Graph Node to be ready (you'll see "Downloading latest blocks from Ethereum" in logs).

### 2. Create and Deploy Subgraph

```bash
# Create the subgraph (only needed once)
npm run create:local

# Build the subgraph
npm run build

# Deploy the subgraph
npm run deploy:local
```

### 3. Query the Subgraph

GraphQL endpoint: `http://localhost:8000/subgraphs/name/sake-finance`

Example query:
```bash
curl -X POST http://localhost:8000/subgraphs/name/sake-finance \
  -H "Content-Type: application/json" \
  -d '{"query": "{ reserves(first: 5) { id symbol name totalATokenSupply } }"}'
```

### 4. GraphQL Playground

Visit: `http://localhost:8000/subgraphs/name/sake-finance/graphql`

### Update/Redeploy

```bash
# Make changes to your subgraph
# Rebuild
npm run build

# Redeploy (increments version automatically)
npm run deploy:local
```

### Stop Graph Node

```bash
docker-compose down

# To remove all data (fresh start)
docker-compose down -v
rm -rf data/
```

## Option 2: Hosted Graph Node

If you want a production deployment, you have several options:

### A. Self-Hosted on Cloud Provider

Deploy Graph Node on:
- AWS (EC2 + RDS)
- Google Cloud (GCE + Cloud SQL)
- DigitalOcean (Droplet + Managed PostgreSQL)

Guide: https://thegraph.com/docs/en/operating-graph-node/

### B. Third-Party Indexing Services

Check if these services support Soneium:
- **Goldsky**: https://goldsky.com/
- **Alchemy Subgraphs**: https://www.alchemy.com/subgraphs
- **QuickNode**: https://www.quicknode.com/

### C. Request Soneium Support from The Graph

File a request at: https://github.com/graphprotocol/support/issues

## Troubleshooting

### Graph Node can't connect to Soneium RPC

Update `docker-compose.yml` with your RPC endpoint:
```yaml
ethereum: 'soneium:https://your-custom-rpc-url.com'
```

You may need a dedicated RPC endpoint with higher rate limits.

### PostgreSQL connection issues

Check if port 5432 is already in use:
```bash
lsof -i :5432
```

### IPFS issues

Clear IPFS data:
```bash
docker-compose down
rm -rf data/ipfs
docker-compose up -d
```

### Subgraph sync is slow

- Reduce `startBlock` in `subgraph.yaml` to a more recent block
- Use an archive node RPC for historical data
- Increase Graph Node resources (CPU, RAM)

## Monitoring

Check indexing status:
```bash
curl http://localhost:8030/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ indexingStatuses { subgraph synced health fatalError { message } chains { network latestBlock { number } } } }"}'
```

## Performance Tips

1. **Use Archive Node**: For historical data queries
2. **Optimize Queries**: Add indexes in schema with `@index` directive
3. **Prune Old Data**: Set `indexerHints.prune: auto` in subgraph.yaml
4. **Scale PostgreSQL**: Increase shared_buffers and work_mem
5. **Monitor Resources**: Use Grafana + Prometheus for metrics

## Production Checklist

- [ ] Use dedicated RPC endpoint with high rate limits
- [ ] Set up automated backups for PostgreSQL
- [ ] Configure monitoring and alerts
- [ ] Use reverse proxy (Nginx) for GraphQL endpoint
- [ ] Enable HTTPS with SSL certificates
- [ ] Set up log aggregation (ELK stack)
- [ ] Implement rate limiting on GraphQL API
- [ ] Document API usage for frontend team

## Resources

- [The Graph Docs](https://thegraph.com/docs/)
- [Graph Node Repository](https://github.com/graphprotocol/graph-node)
- [Subgraph Best Practices](https://thegraph.com/docs/en/developing/creating-a-subgraph/#best-practices)
- [GraphQL Query Optimization](https://thegraph.com/docs/en/querying/querying-best-practices/)
