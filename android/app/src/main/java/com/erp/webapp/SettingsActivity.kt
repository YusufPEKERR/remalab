package com.erp.webapp

import android.os.Bundle
import android.view.LayoutInflater
import android.widget.Button
import android.widget.EditText
import android.widget.ImageButton
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView

class SettingsActivity : AppCompatActivity() {

    private lateinit var siteManager: SiteManager
    private lateinit var recyclerView: RecyclerView
    private lateinit var adapter: SiteAdapter
    private var config: SitesConfig = SitesConfig()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        siteManager = SiteManager(this)

        val btnBack: ImageButton = findViewById(R.id.btnBack)
        btnBack.setOnClickListener { finish() }

        val btnAddSite: Button = findViewById(R.id.btnAddSite)
        btnAddSite.setOnClickListener { showAddEditDialog(null) }

        recyclerView = findViewById(R.id.recyclerViewSites)
        recyclerView.layoutManager = LinearLayoutManager(this)

        adapter = SiteAdapter(
            sites = emptyList(),
            defaultSiteId = "",
            onMakeDefaultClick = { site ->
                siteManager.setDefaultSite(site.id)
                loadData()
                Toast.makeText(this, "'${site.name}' varsayılan site yapıldı.", Toast.LENGTH_SHORT).show()
            },
            onEditClick = { site -> showAddEditDialog(site) },
            onDeleteClick = { site -> showDeleteConfirmation(site) }
        )
        recyclerView.adapter = adapter

        loadData()
    }

    private fun loadData() {
        config = siteManager.loadConfig()
        adapter.updateData(config.sites, config.default_site_id)
    }

    private fun showAddEditDialog(siteToEdit: SiteItem?) {
        val dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_add_edit_site, null)

        val tvTitle: TextView = dialogView.findViewById(R.id.tvDialogTitle)
        val etName: EditText = dialogView.findViewById(R.id.etSiteName)
        val etUrl: EditText = dialogView.findViewById(R.id.etSiteUrl)
        val btnCancel: Button = dialogView.findViewById(R.id.btnCancel)
        val btnSave: Button = dialogView.findViewById(R.id.btnSave)

        if (siteToEdit != null) {
            tvTitle.text = "✏️ Site Düzenle"
            etName.setText(siteToEdit.name)
            etUrl.setText(siteToEdit.url)
        } else {
            tvTitle.text = "➕ Yeni Site Ekle"
        }

        val alertDialog = AlertDialog.Builder(this)
            .setView(dialogView)
            .setCancelable(true)
            .create()

        btnCancel.setOnClickListener { alertDialog.dismiss() }
        btnSave.setOnClickListener {
            val name = etName.text.toString().trim()
            val url = etUrl.text.toString().trim()

            if (name.isEmpty()) {
                Toast.makeText(this, "Lütfen bir site adı girin.", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            if (url.isEmpty()) {
                Toast.makeText(this, "Lütfen bir site URL'si girin.", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            if (siteToEdit != null) {
                siteManager.updateSite(siteToEdit.id, name, url)
                Toast.makeText(this, "'$name' güncellendi.", Toast.LENGTH_SHORT).show()
            } else {
                siteManager.addSite(name, url)
                Toast.makeText(this, "'$name' eklendi.", Toast.LENGTH_SHORT).show()
            }

            loadData()
            alertDialog.dismiss()
        }

        alertDialog.show()
    }

    private fun showDeleteConfirmation(site: SiteItem) {
        AlertDialog.Builder(this)
            .setTitle("Site Silinsin mi?")
            .setMessage("'${site.name}' sitesini silmek istediğinize emin misiniz?")
            .setPositiveButton("Sil") { _, _ ->
                siteManager.deleteSite(site.id)
                loadData()
                Toast.makeText(this, "'${site.name}' silindi.", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("İptal", null)
            .show()
    }
}
