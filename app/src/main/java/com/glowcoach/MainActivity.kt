package com.glowcoach

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.glowcoach.ui.theme.GlowCoachTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.OutputStreamWriter
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

data class ChatMessage(val sender: String, val text: String)

@Composable
fun ChatScreen() {
    var message by remember { mutableStateOf("") }
    var isSending by remember { mutableStateOf(false) }
    var chatLog by remember {
        mutableStateOf(
            listOf(
                ChatMessage(
                    "GlowCoach",
                    "Hey, I’m GlowCoach. Tell me what you’re trying to build right now — money, confidence, discipline, health, or just life in general?"
                )
            )
        )
    }

    val scope = rememberCoroutineScope()
    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF4F4F9))
            .padding(16.dp)
    ) {
        Text(
            "GlowCoach",
            style = MaterialTheme.typography.headlineLarge,
            fontWeight = FontWeight.Black,
            color = Color(0xFF101828)
        )
        Text(
            "Your motivational AI partner.",
            color = Color(0xFF667085),
            modifier = Modifier.padding(bottom = 16.dp)
        )

        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .verticalScroll(scrollState)
        ) {
            chatLog.forEach { item ->
                val isUser = item.sender == "You"
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
                ) {
                    Column(
                        modifier = Modifier
                            .padding(vertical = 4.dp)
                            .fillMaxWidth(0.85f)
                            .background(
                                if (isUser) Color(0xFF101828) else Color.White,
                                RoundedCornerShape(18.dp)
                            )
                            .padding(12.dp)
                    ) {
                        Text(
                            item.sender,
                            fontWeight = FontWeight.Bold,
                            color = if (isUser) Color(0xFFFFD166) else Color(0xFF101828)
                        )
                        Text(
                            item.text,
                            color = if (isUser) Color.White else Color(0xFF101828)
                        )
                    }
                }
            }
        }

        if (isSending) {
            Text(
                "GlowCoach is thinking...",
                color = Color(0xFF667085),
                modifier = Modifier.padding(vertical = 8.dp)
            )
        }

        OutlinedTextField(
            value = message,
            onValueChange = { message = it },
            label = { Text("Text GlowCoach...") },
            modifier = Modifier.fillMaxWidth(),
            minLines = 1,
            maxLines = 4
        )

        Spacer(modifier = Modifier.height(8.dp))

        Button(
            enabled = message.isNotBlank() && !isSending,
            onClick = {
                val textToSend = message.trim()
                message = ""
                chatLog = chatLog + ChatMessage("You", textToSend)
                isSending = true

                scope.launch {
                    val reply = sendChatMessage(textToSend)
                    chatLog = chatLog + ChatMessage("GlowCoach", reply)
                    isSending = false
                }
            },
            modifier = Modifier.align(Alignment.End),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFFD166))
        ) {
            Text("Send", color = Color(0xFF101828), fontWeight = FontWeight.Bold)
        }
    }
}

suspend fun sendChatMessage(message: String): String = withContext(Dispatchers.IO) {
    try {
        // Android emulator uses 10.0.2.2 to reach your computer's localhost.
        // If testing on a real phone, replace this with your computer IP or your Render URL.
        val apiUrl = "http://10.0.2.2:3000/chat"

        val connection = URL(apiUrl).openConnection() as HttpURLConnection
        connection.requestMethod = "POST"
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
        connection.setRequestProperty("Accept", "application/json")
        connection.doOutput = true

        val jsonBody = JSONObject()
        jsonBody.put("message", message)

        OutputStreamWriter(connection.outputStream).use { writer ->
            writer.write(jsonBody.toString())
        }

        val responseCode = connection.responseCode
        val stream = if (responseCode in 200..299) connection.inputStream else connection.errorStream
        val responseText = stream.bufferedReader().use { it.readText() }

        if (responseCode !in 200..299) {
            return@withContext "Backend error: $responseText"
        }

        val json = JSONObject(responseText)
        json.optString("reply", "I’m here for you!")
    } catch (e: Exception) {
        "I couldn’t reach the backend. Make sure the server is running and the API URL is correct."
    }
}
