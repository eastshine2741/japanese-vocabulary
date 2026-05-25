variable "cloudflare_api_token" {
  type        = string
  description = "Cloudflare API token (Zone:DNS:Edit + Zone:Zone:Read)"
  sensitive   = true
}

variable "cloudflare_zone_name" {
  type        = string
  description = "Cloudflare zone (root domain) to manage"
  default = "eastshine.dev"
}

variable "hcloud_token" {
  type        = string
  description = "Hetzner Cloud API token"
  sensitive   = true
}
