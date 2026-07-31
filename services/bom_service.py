from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from models.product_bom_node import ProductBomNode

class BomService:
    def __init__(self, db: Session):
        self.db = db

    def get_product_bom_tree(self, product_code: str) -> List[Dict[str, Any]]:
        """
        Belirtilen cihaz/ürün (product_code) için BOM ağacını döndürür.
        Önce ProductBomNode'dan cihazın alt parçalarını bulur, 
        sonra bu parçaların ItemBomNode'dan alt kırılımlarını (recursive) bulur.
        """
        tree = []
        # Ürünün ana bileşenleri
        root_nodes = self.db.query(ProductBomNode).filter_by(
            parent_product_code=product_code, enabled=True
        ).all()
        
        for node in root_nodes:
            child_tree = self.get_item_bom_tree(node.child_item_code)
            tree.append({
                "item_code": node.child_item_code,
                "quantity": node.quantity,
                "children": child_tree
            })
            
        return tree

    def get_item_bom_tree(self, item_code: str, visited: Optional[set] = None) -> List[Dict[str, Any]]:
        """
        Belirtilen yedek parça/malzemenin (item_code) alt bileşenlerini bulur (Recursive).
        Sonsuz döngüyü önlemek için visited seti kullanılır.
        """
        if visited is None:
            visited = set()
            
        if item_code in visited:
            return []
            
        visited.add(item_code)
        
        children = []
        nodes = self.db.query(ItemBomNode).filter_by(
            parent_item_code=item_code, enabled=True
        ).all()
        
        for node in nodes:
            grand_children = self.get_item_bom_tree(node.child_item_code, visited)
            children.append({
                "item_code": node.child_item_code,
                "quantity": node.quantity,
                "children": grand_children
            })
            
        return children
