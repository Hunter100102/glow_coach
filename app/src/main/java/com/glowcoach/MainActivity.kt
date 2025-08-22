
package com.glowcoach

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.glowcoach.ui.theme.GlowCoachTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            GlowCoachTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    ChatScreen()
                }
            }
        }
    }
}

@Composable
fun ChatScreen() {
    var message by remember { mutableStateOf("") }
    var chatLog by remember { mutableStateOf(listOf<String>()) }

    Column(modifier = Modifier.padding(16.dp)) {
        Text("GlowCoach", style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(16.dp))
        Column(modifier = Modifier.weight(1f)) {
            chatLog.forEach { msg -> Text("Bot: $msg", modifier = Modifier.padding(4.dp)) }
        }
        OutlinedTextField(value = message, onValueChange = { message = it }, label = { Text("Say something...") })
        Spacer(modifier = Modifier.height(8.dp))
        Button(onClick = {
            chatLog = chatLog + message + " (response coming soon...)"
            message = ""
        }) {
            Text("Send")
        }
    }
}
    