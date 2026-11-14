package ru.localization;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.resource.ResourceManagerHelper;
import net.fabricmc.fabric.api.resource.ResourcePackActivationType;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.text.Text;
import net.minecraft.util.Identifier;

public class RuLocalization implements ClientModInitializer {
	@Override
	public void onInitializeClient() {
		ResourceManagerHelper.registerBuiltinResourcePack(
			Identifier.of("rulocalization", "translations"),
			FabricLoader.getInstance().getModContainer("rulocalization").orElseThrow(),
			Text.literal("Russian Localization"),
			ResourcePackActivationType.ALWAYS_ENABLED
		);
	}
}
