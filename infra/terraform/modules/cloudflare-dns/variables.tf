variable "zone_id" {
  type        = string
  description = "Cloudflare zone ID"
}

variable "records" {
  type = map(object({
    name    = string
    type    = string
    content = string
    ttl     = number
    proxied = bool
  }))
  description = "DNS records to manage, keyed by logical name"
}
