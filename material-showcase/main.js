(function() {
  "use strict";

  // globals
  var $ = window.$;

  var model =
    "https://sketchfab.com/models/93166cb1877f4895a91411334460898b/embed?material_showcase=1&autostart=1";
  var materials = {
    "Couch": [
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Couch/Thumbnail.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Couch/couch_Ambient_Occlusion.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Couch/couch_Base_Color.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Couch/couch_Metallic.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Couch/couch_Normal.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Couch/couch_Roughness.jpg"
    ],
    "CrakedGroundTiles": [
        "https://labs.sketchfab.com/experiments/material-showcase/materials/CrakedGroundTiles/CrackedGroundTiles_Ambient_Occlusion.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/CrakedGroundTiles/CrackedGroundTiles_Base_Color.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/CrakedGroundTiles/CrackedGroundTiles_Metallic.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/CrakedGroundTiles/CrackedGroundTiles_Normal.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/CrakedGroundTiles/CrackedGroundTiles_Roughness.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/CrakedGroundTiles/Thumbnail.jpg"
    ],
    "Crocodile_Skin": [
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Crocodile_Skin/Thumbnail.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Crocodile_Skin/crocodile_skin_Ambient_Occlusion.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Crocodile_Skin/crocodile_skin_Base_Color.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Crocodile_Skin/crocodile_skin_Metallic.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Crocodile_Skin/crocodile_skin_Normal.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Crocodile_Skin/crocodile_skin_Roughness.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Crocodile_Skin/crocodile_skin_Specular.jpg"
    ],
    "Fallen_Painted_metal": [
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Fallen_Painted_metal/Fallen_Painted_Metal_Base_Color.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Fallen_Painted_metal/Fallen_Painted_Metal_Metallic.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Fallen_Painted_metal/Fallen_Painted_Metal_Normal.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Fallen_Painted_metal/Fallen_Painted_Metal_Roughness.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Fallen_Painted_metal/Thumbnail.jpg"
    ],
    "Metal_Cooper": [
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Metal_Cooper/Thumbnail.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Metal_Cooper/metal_brushed_copper_Base_Color.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Metal_Cooper/metal_brushed_copper_Metallic.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Metal_Cooper/metal_brushed_copper_Normal.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Metal_Cooper/metal_brushed_copper_Roughness.jpg"
    ],
    "Metal_Floor_Base": [
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Metal_Floor_Base/MetalFloorsBare_Base_Color.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Metal_Floor_Base/MetalFloorsBare_Metallic.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Metal_Floor_Base/MetalFloorsBare_Normal.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Metal_Floor_Base/MetalFloorsBare_Roughness.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Metal_Floor_Base/Thumbnail.jpg"
    ],
    "Metal_Painted": [
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Metal_Painted/Thumbnail.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Metal_Painted/metal_painted_barrel_Ambient_Occlusion.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Metal_Painted/metal_painted_barrel_Base_Color.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Metal_Painted/metal_painted_barrel_Diffuse.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Metal_Painted/metal_painted_barrel_Glossiness.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Metal_Painted/metal_painted_barrel_Height.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Metal_Painted/metal_painted_barrel_Metallic.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Metal_Painted/metal_painted_barrel_Normal.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Metal_Painted/metal_painted_barrel_Roughness.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Metal_Painted/metal_painted_barrel_Specular.jpg"
    ],
    "Metal_Rusty": [
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Metal_Rusty/",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Metal_Rusty/Thumbnail.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Metal_Rusty/metal_aircraft_interior_rusty_Base_Color.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Metal_Rusty/metal_aircraft_interior_rusty_Metallic.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Metal_Rusty/metal_aircraft_interior_rusty_Normal.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Metal_Rusty/metal_aircraft_interior_rusty_Roughness.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Metal_Rusty/metal_aircraft_interior_rusty_Specular.jpg"
    ],
    "Plastic": [
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Plastic/Thumbnail.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Plastic/plastic_base_Base_Color.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Plastic/plastic_base_Metallic.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Plastic/plastic_base_Normal.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Plastic/plastic_base_Roughness.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Plastic/plastic_base_Specular.jpg"
    ],
    "RhombusTiles": [
        "https://labs.sketchfab.com/experiments/material-showcase/materials/RhombusTiles/Thumbnail.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/RhombusTiles/Tiles_Ambient_Occlusion.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/RhombusTiles/Tiles_Base_Color.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/RhombusTiles/Tiles_Metallic.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/RhombusTiles/Tiles_Normal.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/RhombusTiles/Tiles_Roughness.jpg"
    ],
    "Stylized_Ice": [
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Stylized_Ice/Thumbnail.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Stylized_Ice/ice_stylized_Base_Color.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Stylized_Ice/ice_stylized_Metallic.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Stylized_Ice/ice_stylized_Normal.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Stylized_Ice/ice_stylized_Roughness.jpg"
    ],
    "Watermelon": [
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Watermelon/Thumbnail.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Watermelon/Watermelon_Ambient_Occlusion.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Watermelon/Watermelon_Base_Color.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Watermelon/Watermelon_Height.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Watermelon/Watermelon_Metallic.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Watermelon/Watermelon_Normal.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Watermelon/Watermelon_Roughness.jpg"
    ],
    "Wooden_Planks": [
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Wooden_Planks/Thumbnail.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Wooden_Planks/wooden_planks_Base_Color.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Wooden_Planks/wooden_planks_Metallic.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Wooden_Planks/wooden_planks_Normal.jpg",
        "https://labs.sketchfab.com/experiments/material-showcase/materials/Wooden_Planks/wooden_planks_Roughness.jpg"
    ]
  };
  var domain = window.location.href.replace("index.html", "");

  function start() {
    var html =
      '<iframe width="640" height="480" src="' +
      model +
      '" frameborder="0" allowfullscreen mozallowfullscreen="true" webkitallowfullscreen="true" onmousewheel=""></iframe>';

    var iframe = html;
    $(".iframe").append(iframe);
  }

  function applyMaterial(id) {
    console.log(materials[id]);
    var iframeURL = model + "#material_showcase=1," + materials[id].params;
    $("iframe").attr("src", iframeURL);
  }

  function renderMaterialList() {
    var out = "";
    Object.keys(materials).forEach(function(materialName) {
      if (materials[materialName].thumbnail) {
        out +=
          '<li class="material" data-material="' +
          materialName +
          '"><img src="' +
          materials[materialName].thumbnail +
          '" alt="' +
          materialName +
          '"></li>';
      } else {
        out +=
          '<li class="material" data-material="' +
          materialName +
          '"><span>' +
          materialName +
          "</span></li>";
      }
    });
    $(".materials").html(out);
  }

  function onLoadingStart() {
    $(".loading").addClass("active");
  }

  function onLoadingStop() {
    $(".loading").removeClass("active");
  }

  function fetchMaterials() {
    var url = "materials/materials.xml";
    Object.keys(materials).forEach(function(materialName) {
      var files = materials[materialName];
      var urlParams = [];
      var hasAO = false;
      var hasNormal = false;
      files.forEach(function(file) {
        if (file.match("Base_Color")) {
          urlParams.push("material_diffuse=" + file);
          return;
        }

        if (file.match("Metallic")) {
          urlParams.push("material_metalness=" + file);
          return;
        }

        if (file.match("Ambient_Occlusion")) {
          urlParams.push("material_cavity=" + file);
          hasAO = true;
          return;
        }

        if (file.match("Normal")) {
          urlParams.push("material_normal=" + file);
          hasNormal = true;
          return;
        }

        if (file.match("Roughness")) {
          urlParams.push("material_roughness=" + file);
          return;
        }

        if (file.match("Thumbnail.jpg")) {
          materials[materialName]["thumbnail"] = file;
        }

        if (file.match(/\.url$/)) {
          materials[materialName]["linkFile"] = file;
        }
      });

      if (!hasAO) urlParams.push("material_cavity=");
      if (!hasNormal) urlParams.push("material_normal=");

      materials[materialName]["params"] = urlParams.join(",");
    });

    console.log(Object.keys(materials).length + " materials loaded");
    console.log(materials);

    renderMaterialList();
  }

  $(function() {
    $(".materials").on("click", ".material", function(e) {
      e.preventDefault();
      var $target = $(e.currentTarget);
      var materialId = $target.attr("data-material");
      applyMaterial(materialId);
      $(".material-selected").html("<h1>" + materialId.replaceAll('_', ' ') + "</h1>");
      onLoadingStart();
      setTimeout(onLoadingStop, 1000);
    });

    start();
    fetchMaterials();
  });
})();
