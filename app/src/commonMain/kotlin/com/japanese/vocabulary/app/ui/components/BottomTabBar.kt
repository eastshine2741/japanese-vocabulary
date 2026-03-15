package com.japanese.vocabulary.app.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.MenuBook
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.japanese.vocabulary.app.navigation.Tab
import com.japanese.vocabulary.app.theme.AppColors
import com.japanese.vocabulary.app.theme.AppDimens

@Composable
fun BottomTabBar(selectedTab: Tab, onTabSelected: (Tab) -> Unit) {
    Surface(
        color = AppColors.Surface,
        shadowElevation = 8.dp
    ) {
        HorizontalDivider(color = AppColors.CardBorder, thickness = 0.5.dp)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(AppDimens.BottomBarHeight)
                .padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.SpaceAround,
            verticalAlignment = Alignment.CenterVertically
        ) {
            TabItem(
                icon = Icons.Outlined.Home,
                label = "Home",
                isSelected = selectedTab == Tab.Home,
                onClick = { onTabSelected(Tab.Home) }
            )
            TabItem(
                icon = Icons.Outlined.MenuBook,
                label = "Words",
                isSelected = selectedTab == Tab.Words,
                onClick = { onTabSelected(Tab.Words) }
            )
            TabItem(
                icon = Icons.Outlined.Person,
                label = "MyPage",
                isSelected = selectedTab == Tab.MyPage,
                onClick = { onTabSelected(Tab.MyPage) }
            )
        }
    }
}

@Composable
private fun TabItem(
    icon: ImageVector,
    label: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    val color = if (isSelected) AppColors.TabActive else AppColors.TabInactive
    IconButton(onClick = onClick) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = color,
                modifier = Modifier.size(24.dp)
            )
            Spacer(Modifier.height(2.dp))
            Text(
                text = label,
                color = color,
                fontSize = 11.sp
            )
        }
    }
}
