package com.erp.webapp

data class SiteItem(
    val id: String,
    val name: String,
    val url: String
)

data class SitesConfig(
    var default_site_id: String = "",
    var sites: MutableList<SiteItem> = mutableListOf()
)
