output "cloudflare_zone_id" {
  value       = data.cloudflare_zone.main.id
  description = "Cloudflare zone ID for eastshine.dev"
}
