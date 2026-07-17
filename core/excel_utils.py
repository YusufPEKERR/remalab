def style_excel_file(filepath: str):
    """Excel dosyasını openpyxl kullanarak premium ve estetik bir tasarıma kavuşturur."""
    try:
        import openpyxl
        from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
        
        wb = openpyxl.load_workbook(filepath)
        for sheet in wb.worksheets:
            # Renk Paleti ve Stiller
            header_fill = PatternFill(start_color="212B36", end_color="212B36", fill_type="solid") # Koyu şık gri/lacivert
            even_row_fill = PatternFill(start_color="F4F6F8", end_color="F4F6F8", fill_type="solid") # Açık gri alternatif satır
            odd_row_fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid") # Beyaz satır
            
            header_font = Font(name="Segoe UI", color="FFFFFF", bold=True, size=11)
            data_font = Font(name="Segoe UI", color="161C24", size=10)
            
            center_align = Alignment(horizontal="center", vertical="center")
            left_align = Alignment(horizontal="left", vertical="center", wrap_text=True)
            
            # Sadece altı çizili zarif kenarlık (Modern web tabloları gibi)
            light_gray_side = Side(style='thin', color='E2E8F0')
            modern_border = Border(bottom=light_gray_side, left=light_gray_side, right=light_gray_side)
            header_border = Border(bottom=Side(style='medium', color='1F6FEB')) # Başlığın altına mavi bir vurgu
            
            # Satır Yükseklikleri
            sheet.row_dimensions[1].height = 28 # Başlık daha ferah
            
            # Başlık satırını (Satır 1) biçimlendir
            for cell in sheet[1]:
                cell.fill = header_fill
                cell.font = header_font
                cell.alignment = center_align
                cell.border = header_border
                
            # Tüm veri satırlarını biçimlendir ve sütun genişliklerini ayarla
            for col_idx, col in enumerate(sheet.columns, 1):
                max_length = 0
                col_letter = openpyxl.utils.get_column_letter(col_idx)
                for cell in col:
                    if cell.row > 1:
                        # Satır yüksekliği
                        sheet.row_dimensions[cell.row].height = 22
                        
                        # Alternatif arka plan rengi
                        if cell.row % 2 == 0:
                            cell.fill = even_row_fill
                        else:
                            cell.fill = odd_row_fill
                            
                        cell.font = data_font
                        cell.border = modern_border
                        cell.alignment = left_align
                        
                    try:
                        val_str = str(cell.value) if cell.value is not None else ""
                        if len(val_str) > max_length:
                            max_length = len(val_str)
                    except:
                        pass
                
                # Sütun genişliğini içeriğe göre ayarla (min 15, max 45)
                adjusted_width = min(max(int(max_length * 1.3) + 4, 15), 50)
                sheet.column_dimensions[col_letter].width = adjusted_width
                
            # İlk satırı dondur (sabit kalsın)
            sheet.freeze_panes = 'A2'
            
        wb.save(filepath)
    except Exception as e:
        print(f"Excel stili uygulanırken hata oluştu: {e}")
