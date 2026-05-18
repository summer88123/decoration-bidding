"""
BOQ Engine - 从 IFC 模型自动提取工程量清单
"""
from __future__ import annotations
import ifcopenshell
import ifcopenshell.util.element as util_element


class BOQEngine:
    """将 IFC 构件映射为工程量清单项"""

    RULES = {
        "IfcWall": {"unit": "m²", "quantity_type": "area", "description": "墙面"},
        "IfcSlab": {"unit": "m²", "quantity_type": "area", "description": "楼板/天花"},
        "IfcDoor": {"unit": "扇", "quantity_type": "count", "description": "门"},
        "IfcWindow": {"unit": "扇", "quantity_type": "count", "description": "窗"},
        "IfcColumn": {"unit": "根", "quantity_type": "count", "description": "柱"},
        "IfcBeam": {"unit": "m", "quantity_type": "length", "description": "梁"},
    }

    def extract_boq(self, model: ifcopenshell.file) -> list[dict]:
        boq_items = []
        for ifc_type, rule in self.RULES.items():
            elements = model.by_type(ifc_type)
            if not elements:
                continue
            boq_items.append({
                "item_type": ifc_type,
                "description": rule["description"],
                "quantity": len(elements),
                "unit": rule["unit"],
                "elements": [el.GlobalId for el in elements],
            })
        return boq_items
