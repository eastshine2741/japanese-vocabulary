package com.japanese.vocabulary.userinventory.entity

import java.io.Serializable

data class UserInventoryId(
    val userId: Long = 0,
    val itemType: InventoryItemType = InventoryItemType.STREAK_FREEZE,
) : Serializable
