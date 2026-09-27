resource "hcloud_placement_group" "main" {
  name = var.placement_group_name
  type = "spread"
}

resource "hcloud_server" "node" {
  count = var.node_count

  name               = "${var.name_prefix}-${count.index + 1}"
  server_type        = var.server_type
  image              = var.image
  location           = var.location
  placement_group_id = hcloud_placement_group.main.id
}
