variable "name_prefix" {
  type        = string
  description = "Prefix of node name"
}

variable "node_count" {
  type        = number
  description = "Size of node pool"
}

variable "server_type" {
  type        = string
  description = "Hetzner server type to use"
}

variable "image" {
  type        = string
  description = "OS image to use"
  default     = "ubuntu-24.04"
}

variable "location" {
  type        = string
  description = "Hetzner location"
}

variable "placement_group_name" {
  type        = string
  description = "Name of the spread placement group"
}

variable "ssh_keys" {
  type        = list(string)
  description = "Hetzner SSH key names installed on newly created nodes"
  default     = []
}

variable "network_id" {
  type        = string
  description = "Hetzner private network ID the nodes attach to"
}

variable "private_ips" {
  type        = list(string)
  description = "Private IP per node, in node index order (k3s --node-ip)"

  validation {
    condition     = length(var.private_ips) == var.node_count
    error_message = "private_ips must have exactly node_count entries."
  }
}
