---
title: "Left Joining Multiple Collections in Mongo"
date: 2023-06-14
id: blog0139
tag: mongo
intro: "$lookup only works for the whole collection, we demonstrate how to left join another collection using a field which is an array."
toc: true
---

#### Look up from Arrays Instead of Collections

##### Objective

- Since look up is only available for collections in mongodb, if there is a property among the array of elements, like `id`, which we need to left join with another collection. We need to `$unwind` it to reduce the problem into our old familiar problem.

- Finally we need to undo the `$unwind` process, which can be done by using using all other fields jointly to form an`_id` object, then we push the lookup results into an array according to this `_id`.

- We then use `$replaceRoot: {  newRoot: ... }` trick to move everything in `_id: {...}` to the parent level.


##### Detail


```javascript=1
[
    {
        $lookup: {
            let: { group_code: "$group_code" },
            from: "ns_material_category_groups",
            pipeline: [
                { $match: { $expr: { $eq: ["$code", "$$group_code"] } } },
                { $project: { name: 1, code: 1, _id: 0 } }
            ],
            as: "materialGroup"
        }
    },
    {
        $match: {
            $expr: {
                $eq: ["$enabled", "Y"]
            }
        }
    },
    {
        $unwind: "$materialGroup"
    },
```
This lookup only aims at left-joining `ns_material_category_groups` to get `materialGroup`, which becomes an array of objects of only 1 element (due to 1-1 correspondance), we `$unwind` to sequeeze the array into an object:
```none
 [{
    "_id": {
        "timestamp": 1648724334,
        "date": "2022-03-31T10:58:54.000+00:00"
    },
    "name": "Ceramic Tiles",
    "code": "FINISHES_CERAMIC_TILES",
    "uom_rdbms_id": 2,
    "group_code": "InteriorFinishes",
    "prefill_desc": "Usage1 (Interior/Exterior):\r\nUsage2 (Floor/Wall/Floor&Wall):\r\nFinish:\r\nColour:\r\nShape:\r\nSize(mm):\r\nThickness(mm):\r\nWeight(kg):\r\nHardness:\r\nWater Resistant (Yes/No):\r\nSlip Resistance:\r\nBacteria Resistance:\r\nChemical Resistance:\r\nStain Resistance:\r\nWheelchair Friendly (Yes/No):\r\nOther Features:",
    "enabled": "Y",
    "match_dummy_products": "Y",
    "margin_calc_group": "READY_TO_SHIP2",
    "freight_calc_group": "LOAD_CAPACITY",
    "materialGroup": {
        "name": "Interior Finishes",
        "code": "InteriorFinishes"
    }
}]
```
We next need to lookup from another collection using the field `code`:
```javascript=13
   {
        $lookup: {
            let: { code: "$code" },
            from: "ns_materials",
            pipeline: [
                {
                    $match: {
                        $expr: {
                            $and: [
                                { $eq: ["$category_code", "$$code"] },
                                { $eq: ["$is_dummy", "Y"] }
                            ]
                        }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        manu_code: 1,
                    }
                }
            ],
            as: "suppliers"
        }
    },
```

At this point our queried object becomes
```none
[
    {
        "_id": {
            "timestamp": 1648724334,
            "date": "2022-03-31T10:58:54.000+00:00"
        },
        "name": "Ceramic Tiles",
        "code": "FINISHES_CERAMIC_TILES",
        "uom_rdbms_id": 2,
        "group_code": "InteriorFinishes",
        "prefill_desc": "Usage1 (Interior/Exterior):\r\nUsage2 (Floor/Wall/Floor&Wall):\r\nFinish:\r\nColour:\r\nShape:\r\nSize(mm):\r\nThickness(mm):\r\nWeight(kg):\r\nHardness:\r\nWater Resistant (Yes/No):\r\nSlip Resistance:\r\nBacteria Resistance:\r\nChemical Resistance:\r\nStain Resistance:\r\nWheelchair Friendly (Yes/No):\r\nOther Features:",
        "enabled": "Y",
        "match_dummy_products": "Y",
        "margin_calc_group": "READY_TO_SHIP2",
        "freight_calc_group": "LOAD_CAPACITY",
        "materialGroup": {
            "name": "Interior Finishes",
            "code": "InteriorFinishes"
        },
        "suppliers": [
            {
                "manu_code": "DAUGRES"
            },
            {
                "manu_code": "ELEPHOME"
            },
            {
                "manu_code": "HONGYU"
            },
            {
                "manu_code": "KITO"
            },
            {
                "manu_code": "MMMOSAIC"
            }
        ]
    },
 ...
]
```
But we need to look up from another collection using `manu_code`, we `$unwind` the `suppliers` field and do a `$lookup` from `ns_material_manus` again to get the `name_en` field.



```javascript=38
    {
        $unwind: "$suppliers"
    },
    {
        $lookup: {
            let: { manu_code: "$suppliers.manu_code" },
            from: "ns_material_manus",
            pipeline: [
                {
                    $match: {
                        $expr: {
                            $eq: ["$$manu_code", "$internal_code"]
                        }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        name_en: 1
                    }
                },
                { $limit: 1 }
            ],
            as: "supplierDetail"
        }
    },
```
At this point we get
```none
[
    {
        "_id": {
            "timestamp": 1648724334,
            "date": "2022-03-31T10:58:54.000+00:00"
        },
        "name": "Ceramic Tiles",
        "code": "FINISHES_CERAMIC_TILES",
        "uom_rdbms_id": 2,
        "group_code": "InteriorFinishes",
        "prefill_desc": "Usage1 (Interior/Exterior):\r\nUsage2 (Floor/Wall/Floor&Wall):\r\nFinish:\r\nColour:\r\nShape:\r\nSize(mm):\r\nThickness(mm):\r\nWeight(kg):\r\nHardness:\r\nWater Resistant (Yes/No):\r\nSlip Resistance:\r\nBacteria Resistance:\r\nChemical Resistance:\r\nStain Resistance:\r\nWheelchair Friendly (Yes/No):\r\nOther Features:",
        "enabled": "Y",
        "match_dummy_products": "Y",
        "margin_calc_group": "READY_TO_SHIP2",
        "freight_calc_group": "LOAD_CAPACITY",
        "materialGroup": {
            "name": "Interior Finishes",
            "code": "InteriorFinishes"
        },
        "suppliers": {
            "manu_code": "DAUGRES"
        },
        "supplierDetail": [
            {
                "name_en": "DAUGRES"
            }
        ]
    },
    ...
]
```
- Note that we have used `{ $limit: 1 }` as we understand each company only has one name, lookup results are born with being an array.

- We `$unwind` it to get ordinary object and finally use the original fields jointly as an `_id` to group all supplier results:
```javascript=64
    {
        $unwind: "$supplierDetail"
    },
    {
        $group: {
            _id: {
                code: "$code",
                group_code: "$group_code",
                name: "$name",
                "code": "$code",
                "uom_rdbms_id": "$uom_rdbms_id",
                "group_code": "$group_code",
                "enabled": "$enabled",
                "match_dummy_products": "$match_dummy_products",
                "margin_calc_group": "$margin_calc_group",
                "freight_calc_group": "$freight_calc_group",
                "materialGroup": "$materialGroup"
            },
            suppliers: { "$push": { name_en: "$supplierDetail.name_en" } }
        }
    },
```
The result at this point is of the form:
```none
[
    {
        "_id": {
            "code": "EXTERIOR_FINISHES_COMPOSITE_DECKING",
            "group_code": "ExteriorFlooring",
            "name": "Composite Decking",
            "uom_rdbms_id": 2,
            "enabled": "Y",
            "match_dummy_products": "Y",
            "margin_calc_group": "READY_TO_SHIP2",
            "freight_calc_group": "LOAD_CAPACITY",
            "materialGroup": {
                "name": "Exterior Flooring",
                "code": "ExteriorFlooring"
            }
        },
        "suppliers": [
            {
                "name_en": "GREENZONE"
            },
            {
                "name_en": "MEXY"
            }
        ]
    },
    ...
]
```
We finally move everything inside `_id` to upper level:
```javascript=85
    {
        $replaceRoot: {
            newRoot: {
                $mergeObjects: ["$_id", { suppliers: "$suppliers" }]
            }
        }
    }
]
```    
which finally yields
```json
[
    {
        "code": "TAPWARES_KITCHEN_TAPWARE",
        "group_code": "Tapwares.Accessories",
        "name": "Kitchen Tapware",
        "uom_rdbms_id": 6,
        "enabled": "Y",
        "match_dummy_products": "Y",
        "margin_calc_group": "READY_TO_SHIP2",
        "freight_calc_group": "LOAD_CAPACITY",
        "materialGroup": {
            "name": "Tapwares and Accessories",
            "code": "Tapwares.Accessories"
        },
        "suppliers": [
            {
                "name_en": "EMPOLO"
            },
            {
                "name_en": "ECCO VITA"
            }
        ]
    },
    ...
]
```