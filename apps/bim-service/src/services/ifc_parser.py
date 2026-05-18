"""
IFC Parser Service
基于 IfcOpenShell 解析 IFC4/IFC4x3 文件
"""
from __future__ import annotations
import ifcopenshell
from pathlib import Path


class IfcParserService:
    """解析 IFC 文件，提取建筑元素、空间结构、材料属性"""

    def parse(self, file_path: str | Path) -> dict:
        model = ifcopenshell.open(str(file_path))
        return {
            "schema": model.schema,
            "project": self._get_project_info(model),
            "elements": self._extract_elements(model),
            "spatial_structure": self._get_spatial_structure(model),
        }

    def _get_project_info(self, model: ifcopenshell.file) -> dict:
        projects = model.by_type("IfcProject")
        if not projects:
            return {}
        project = projects[0]
        return {"name": project.Name, "description": project.Description}

    def _extract_elements(self, model: ifcopenshell.file) -> list[dict]:
        # 提取主要建筑元素
        element_types = ["IfcWall", "IfcSlab", "IfcDoor", "IfcWindow", "IfcColumn", "IfcBeam"]
        elements = []
        for ifc_type in element_types:
            for el in model.by_type(ifc_type):
                elements.append({
                    "id": el.GlobalId,
                    "type": ifc_type,
                    "name": el.Name,
                })
        return elements

    def _get_spatial_structure(self, model: ifcopenshell.file) -> list[dict]:
        storeys = model.by_type("IfcBuildingStorey")
        return [{"id": s.GlobalId, "name": s.Name, "elevation": s.Elevation} for s in storeys]
