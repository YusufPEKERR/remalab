package com.erp.webapp

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.ImageButton
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

class SiteAdapter(
    private var sites: List<SiteItem>,
    private var defaultSiteId: String,
    private val onMakeDefaultClick: (SiteItem) -> Unit,
    private val onEditClick: (SiteItem) -> Unit,
    private val onDeleteClick: (SiteItem) -> Unit
) : RecyclerView.Adapter<SiteAdapter.SiteViewHolder>() {

    class SiteViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val rootLayout: View = view
        val tvSiteName: TextView = view.findViewById(R.id.tvSiteName)
        val tvSiteUrl: TextView = view.findViewById(R.id.tvSiteUrl)
        val tvDefaultBadge: TextView = view.findViewById(R.id.tvDefaultBadge)
        val btnMakeDefault: Button = view.findViewById(R.id.btnMakeDefault)
        val btnEdit: ImageButton = view.findViewById(R.id.btnEdit)
        val btnDelete: ImageButton = view.findViewById(R.id.btnDelete)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): SiteViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_site, parent, false)
        return SiteViewHolder(view)
    }

    override fun onBindViewHolder(holder: SiteViewHolder, position: Int) {
        val site = sites[position]
        holder.tvSiteName.text = site.name
        holder.tvSiteUrl.text = site.url

        val isDefault = site.id == defaultSiteId
        if (isDefault) {
            holder.tvDefaultBadge.visibility = View.VISIBLE
            holder.btnMakeDefault.visibility = View.GONE
        } else {
            holder.tvDefaultBadge.visibility = View.GONE
            holder.btnMakeDefault.visibility = View.VISIBLE
        }

        holder.rootLayout.setOnClickListener { onEditClick(site) }
        holder.btnMakeDefault.setOnClickListener { onMakeDefaultClick(site) }
        holder.btnEdit.setOnClickListener { onEditClick(site) }
        holder.btnDelete.setOnClickListener { onDeleteClick(site) }
    }

    override fun getItemCount(): Int = sites.size

    fun updateData(newSites: List<SiteItem>, newDefaultId: String) {
        sites = newSites
        defaultSiteId = newDefaultId
        notifyDataSetChanged()
    }
}
