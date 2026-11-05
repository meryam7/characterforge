# CharaForge -> Godot 4 loader
# 1. Copy the exported folder into your project (e.g. res://characters/hero/)
# 2. Add a Node2D to a scene, attach this script, set "character_json" in the Inspector.
# 3. Press ui_accept (Enter / Space) in game to cycle through the character's designs.
class_name CharacterLoader
extends Node2D

@export_file("*.json") var character_json: String = "res://characters/character.json"

var data: Dictionary = {}
var textures: Array[Texture2D] = []
var labels: Array[String] = []
var current: int = 0
var sprite: Sprite2D


func _ready() -> void:
	sprite = Sprite2D.new()
	add_child(sprite)
	load_character(character_json)


func load_character(path: String) -> void:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		push_error("CharacterLoader: cannot open %s" % path)
		return
	var parsed = JSON.parse_string(file.get_as_text())
	if typeof(parsed) != TYPE_DICTIONARY:
		push_error("CharacterLoader: invalid JSON in %s" % path)
		return
	data = parsed
	textures.clear()
	labels.clear()
	var base_dir := path.get_base_dir()
	for d in data.get("designs", []):
		var tex = load(base_dir.path_join(str(d["file"])))
		if tex is Texture2D:
			textures.append(tex)
			labels.append(str(d.get("prompt", "")))
	show_design(0)


func show_design(index: int) -> void:
	if textures.is_empty():
		return
	current = wrapi(index, 0, textures.size())
	sprite.texture = textures[current]


func cycle() -> void:
	show_design(current + 1)


func current_label() -> String:
	return labels[current] if current < labels.size() else ""


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_accept"):
		cycle()
