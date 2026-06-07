package com.japanese.vocabulary.userinventory.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.IdClass
import jakarta.persistence.Table

@Entity
@Table(name = "user_inventory")
@IdClass(UserInventoryId::class)
class UserInventoryEntity(
    @Id
    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Id
    @Enumerated(EnumType.STRING)
    @Column(name = "item_type", nullable = false, length = 32)
    val itemType: InventoryItemType,

    /** Invariant: always >= 1. Rows are deleted when consumed to 0. */
    @Column(name = "quantity", nullable = false)
    var quantity: Int,
)
