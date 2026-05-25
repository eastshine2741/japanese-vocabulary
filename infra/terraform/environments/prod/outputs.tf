output "cloudflare_zone_id" {
  value       = data.cloudflare_zone.main.zone_id
  description = "Cloudflare zone ID for eastshine.dev"
}
