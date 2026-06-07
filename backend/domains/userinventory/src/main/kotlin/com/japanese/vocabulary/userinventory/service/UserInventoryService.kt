package com.japanese.vocabulary.userinventory.service

import com.japanese.vocabulary.userinventory.entity.InventoryItemType
import com.japanese.vocabulary.userinventory.entity.UserInventoryEntity
import com.japanese.vocabulary.userinventory.repository.UserInventoryRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class UserInventoryService(
    private val userInventoryRepository: UserInventoryRepository,
) {
    @Transactional
    fun grant(userId: Long, itemType: InventoryItemType, cap: Int): Boolean {
        val existing = userInventoryRepository.findForUpdate(userId, itemType)
        if (existing == null) {
            userInventoryRepository.save(UserInventoryEntity(userId, itemType, quantity = 1))
            return true
        }
        if (existing.quantity >= cap) return false
        existing.quantity += 1
        return true
    }

    @Transactional
    fun consume(userId: Long, itemType: InventoryItemType): Boolean {
        val existing = userInventoryRepository.findForUpdate(userId, itemType) ?: return false
        if (existing.quantity == 1) {
            userInventoryRepository.delete(existing)
        } else {
            existing.quantity -= 1
        }
        return true
    }

    @Transactional(readOnly = true)
    fun quantityOf(userId: Long, itemType: InventoryItemType): Int =
        userInventoryRepository.findByUserIdAndItemType(userId, itemType)?.quantity ?: 0
}
