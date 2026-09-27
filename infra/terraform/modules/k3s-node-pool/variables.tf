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
