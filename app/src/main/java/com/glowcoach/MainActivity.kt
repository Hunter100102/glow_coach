
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
import kotlinx.coroutines.*
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            GlowCoachTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
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
            chatLog.forEach { msg -> Text(msg, modifier = Modifier.padding(4.dp)) }
        }
        OutlinedTextField(value = message, onValueChange = { message = it }, label = { Text("Say something...") })
        Spacer(modifier = Modifier.height(8.dp))
        Button(onClick = {
            val userMessage = "You: $message"
            chatLog = chatLog + userMessage
            val url = URL("http://10.0.2.2:3000/chat")
            CoroutineScope(Dispatchers.IO).launch {
                val connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "POST"
                connection.setRequestProperty("Content-Type", "application/json; utf-8")
                connection.doOutput = true
                connection.outputStream.write("{\"message\": \"$message\"}".toByteArray())
                val response = connection.inputStream.bufferedReader().readText()
                val reply = response.substringAfter("reply":"").substringBefore(""}")
                withContext(Dispatchers.Main) {
                    chatLog = chatLog + "GlowCoach: $reply"
                    message = ""
                }
            }
        }) {
            Text("Send")
        }
    }
}
