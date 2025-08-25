
package com.example.mylibrary

import android.content.Context

object MyLibrary {
    /** Returns a friendly greeting from the library. */
    @JvmStatic
    fun getGreeting(context: Context): String {
        return context.getString(R.string.library_greeting)
    }
}
