package com.japanese.vocabulary.userinventory.repository

import com.japanese.vocabulary.userinventory.entity.InventoryItemType
import com.japanese.vocabulary.userinventory.entity.UserInventoryEntity
import com.japanese.vocabulary.userinventory.entity.UserInventoryId
import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

@Repository
interface UserInventoryRepository : JpaRepository<UserInventoryEntity, UserInventoryId> {

    fun findByUserIdAndItemType(userId: Long, itemType: InventoryItemType): UserInventoryEntity?

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query(
        "SELECT i FROM UserInventoryEntity i " +
            "WHERE i.userId = :userId AND i.itemType = :itemType"
    )
    fun findForUpdate(
        @Param("userId") userId: Long,
        @Param("itemType") itemType: InventoryItemType,
    ): UserInventoryEntity?
}
