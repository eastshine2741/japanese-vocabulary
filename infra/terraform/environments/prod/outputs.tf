output "cloudflare_zone_id" {
  value       = data.cloudflare_zone.main.zone_id
  description = "Cloudflare zone ID for eastshine.dev"
}

output "node_public_ipv4s" {
  value       = module.k3s_node_pool.public_ipv4s
  description = "Public IPv4 addresses of k3s nodes"
}

output "node_ids" {
  value       = module.k3s_node_pool.server_ids
  description = "Hetzner server IDS of k3s nodes"
}

output "node_private_ips" {
  value       = module.k3s_node_pool.private_ips
  description = "Private IPs of k3s nodes (k3s --node-ip)"
}

output "network_id" {
  value       = hcloud_network.main.id
  description = "Hetzner private network ID"
}
