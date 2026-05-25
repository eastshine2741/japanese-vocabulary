output "server_ids" {
  value       = hcloud_server.node[*].id
  description = "IDs of Hetzner servers"
}

output "public_ipv4s" {
  value       = hcloud_server.node[*].ipv4_address
  description = "Public IPv4 addresses of Hetzner servers"
}

output "placement_group_id" {
  value       = hcloud_placement_group.main.id
  description = "ID of Hetzner placement group used by nodes"
}
