
package com.glowcoach.ui.theme

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val GlowColorScheme = lightColorScheme(
    primary = Color(0xFF8ED1FC),
    secondary = Color(0xFFFFD166),
    background = Color(0xFFF4F4F9),
    surface = Color.White,
    onPrimary = Color.Black,
    onSecondary = Color.Black,
    onBackground = Color.DarkGray,
    onSurface = Color.Black
)

@Composable
fun GlowCoachTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = GlowColorScheme,
        typography = Typography(),
        content = content
    )
}
