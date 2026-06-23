package com.castifytv.casting

import android.content.Context
import android.content.Intent
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class CastingModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "CastingModule"

    @ReactMethod
    fun startCastingServer() {
        val context = reactApplicationContext
        val intent = Intent(context, CastingService::class.java)
        context.startService(intent)
    }

    @ReactMethod
    fun stopCastingServer() {
        val context = reactApplicationContext
        val intent = Intent(context, CastingService::class.java)
        context.stopService(intent)
    }

    @ReactMethod
    fun saveFavorites(favoritesJson: String) {
        val sharedPref = reactApplicationContext.getSharedPreferences("castify_prefs", Context.MODE_PRIVATE)
        sharedPref.edit().putString("favorites", favoritesJson).apply()
    }

    @ReactMethod
    fun getFavorites(promise: Promise) {
        val sharedPref = reactApplicationContext.getSharedPreferences("castify_prefs", Context.MODE_PRIVATE)
        val favorites = sharedPref.getString("favorites", "[]")
        promise.resolve(favorites)
    }

    @ReactMethod
    fun saveHidden(hiddenJson: String) {
        val sharedPref = reactApplicationContext.getSharedPreferences("castify_prefs", Context.MODE_PRIVATE)
        sharedPref.edit().putString("hidden", hiddenJson).apply()
    }

    @ReactMethod
    fun getHidden(promise: Promise) {
        val sharedPref = reactApplicationContext.getSharedPreferences("castify_prefs", Context.MODE_PRIVATE)
        val hidden = sharedPref.getString("hidden", "[]")
        promise.resolve(hidden)
    }

    @ReactMethod
    fun setDefaultsInitialized() {
        val sharedPref = reactApplicationContext.getSharedPreferences("castify_prefs", Context.MODE_PRIVATE)
        sharedPref.edit().putBoolean("defaults_initialized", true).apply()
    }

    @ReactMethod
    fun isDefaultsInitialized(promise: Promise) {
        val sharedPref = reactApplicationContext.getSharedPreferences("castify_prefs", Context.MODE_PRIVATE)
        val initialized = sharedPref.getBoolean("defaults_initialized", false)
        promise.resolve(initialized)
    }
}
