package com.erp.webapp

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID

class SiteManager(private val context: Context) {

    private val sitesFile: File
        get() = File(context.filesDir, "sites.json")

    fun loadConfig(): SitesConfig {
        val file = sitesFile
        if (!file.exists()) {
            // Try to load initial sites.json from assets
            return try {
                context.assets.open("sites.json").use { inputStream ->
                    val content = inputStream.bufferedReader().use { it.readText() }
                    val config = parseJson(content)
                    saveConfig(config)
                    config
                }
            } catch (e: Exception) {
                e.printStackTrace()
                val defaultConfig = SitesConfig(
                    default_site_id = "1",
                    sites = mutableListOf(
                        SiteItem("1", "ERP Paneli", "http://10.0.2.2:5173"),
                        SiteItem("2", "Google", "https://www.google.com")
                    )
                )
                saveConfig(defaultConfig)
                defaultConfig
            }
        }

        return try {
            val content = file.readText()
            parseJson(content)
        } catch (e: Exception) {
            e.printStackTrace()
            SitesConfig()
        }
    }

    private fun parseJson(jsonStr: String): SitesConfig {
        val root = JSONObject(jsonStr)
        val defaultId = root.optString("default_site_id", "")
        val jsonArray = root.optJSONArray("sites") ?: JSONArray()
        val siteList = mutableListOf<SiteItem>()

        for (i in 0 until jsonArray.length()) {
            val item = jsonArray.optJSONObject(i) ?: continue
            val id = item.optString("id", UUID.randomUUID().toString())
            val name = item.optString("name", "Site $i")
            val url = item.optString("url", "")
            if (url.isNotEmpty()) {
                siteList.add(SiteItem(id, name, url))
            }
        }

        return SitesConfig(defaultId, siteList)
    }

    fun saveConfig(config: SitesConfig) {
        try {
            val root = JSONObject()
            root.put("default_site_id", config.default_site_id)

            val jsonArray = JSONArray()
            for (site in config.sites) {
                val item = JSONObject()
                item.put("id", site.id)
                item.put("name", site.name)
                item.put("url", site.url)
                jsonArray.put(item)
            }
            root.put("sites", jsonArray)

            sitesFile.writeText(root.toString(2))
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun getDefaultSite(config: SitesConfig): SiteItem? {
        val defaultId = config.default_site_id
        return config.sites.find { it.id == defaultId } ?: config.sites.firstOrNull()
    }

    fun addSite(name: String, url: String): SiteItem {
        val config = loadConfig()
        var formattedUrl = url.trim()
        if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
            formattedUrl = "https://$formattedUrl"
        }
        val newItem = SiteItem(
            id = UUID.randomUUID().toString(),
            name = name.trim(),
            url = formattedUrl
        )
        config.sites.add(newItem)
        if (config.default_site_id.isEmpty()) {
            config.default_site_id = newItem.id
        }
        saveConfig(config)
        return newItem
    }

    fun updateSite(id: String, name: String, url: String) {
        val config = loadConfig()
        var formattedUrl = url.trim()
        if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
            formattedUrl = "https://$formattedUrl"
        }
        val index = config.sites.indexOfFirst { it.id == id }
        if (index != -1) {
            config.sites[index] = SiteItem(id, name.trim(), formattedUrl)
            saveConfig(config)
        }
    }

    fun deleteSite(id: String) {
        val config = loadConfig()
        config.sites.removeAll { it.id == id }
        if (config.default_site_id == id) {
            config.default_site_id = config.sites.firstOrNull()?.id ?: ""
        }
        saveConfig(config)
    }

    fun setDefaultSite(id: String) {
        val config = loadConfig()
        if (config.sites.any { it.id == id }) {
            config.default_site_id = id
            saveConfig(config)
        }
    }
}
