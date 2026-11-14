package agon.menu;

import com.mojang.blaze3d.platform.GlStateManager.DstFactor;
import com.mojang.blaze3d.platform.GlStateManager.SrcFactor;
import com.mojang.blaze3d.systems.RenderSystem;
import java.util.concurrent.CompletableFuture;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.CubeMapRenderer;
import net.minecraft.util.Identifier;
import net.minecraft.util.Util;

public final class Panoramas {
	private static final String[] NAMES = {
		"tropical", "snowy_peaks", "cherry_night", "coral_reef", "forest", "nether", "sunset_village", "lush_cave", "japan_night",
		"end_city", "summer_forest", "aurora_night", "cherry_grove", "dripstone_cave", "end_island", "cherry_sunset", "amplified"
	};
	private static final long SLOT_MS = 20000;
	private static final long FADE_MS = 1600;
	private static final float DEGREES_PER_SECOND = 2.0F;
	private static final CubeMapRenderer[] CUBE_MAPS = new CubeMapRenderer[NAMES.length];
	private static final CompletableFuture<?>[] LOADS = new CompletableFuture<?>[NAMES.length];
	private static final long START = Util.getMeasuringTimeMs();
	private static final int FIRST = (int) (START % NAMES.length);

	private Panoramas() {
	}

	public static void render() {
		long elapsed = Util.getMeasuringTimeMs() - START;
		int slot = (int) (elapsed / SLOT_MS);
		long phase = elapsed % SLOT_MS;
		int current = (FIRST + slot) % NAMES.length;
		int next = (current + 1) % NAMES.length;
		float yaw = -elapsed / 1000.0F * DEGREES_PER_SECOND;
		float pitch = (float) Math.sin(elapsed / 6000.0) * 5.0F + 25.0F;

		load(current);
		load(next);
		for (int i = 0; i < NAMES.length; i++) {
			if (i != current && i != next) {
				release(i);
			}
		}

		RenderSystem.enableBlend();
		RenderSystem.blendFuncSeparate(SrcFactor.SRC_ALPHA, DstFactor.ONE_MINUS_SRC_ALPHA, SrcFactor.ZERO, DstFactor.ONE);
		draw(current, pitch, yaw, 1.0F);
		if (phase >= SLOT_MS - FADE_MS) {
			draw(next, pitch, yaw, (phase - (SLOT_MS - FADE_MS)) / (float) FADE_MS);
		}
		RenderSystem.defaultBlendFunc();
		RenderSystem.disableBlend();
	}

	private static void draw(int index, float pitch, float yaw, float alpha) {
		if (LOADS[index].isDone()) {
			CUBE_MAPS[index].draw(MinecraftClient.getInstance(), pitch, yaw, alpha);
		}
	}

	private static void release(int index) {
		if (LOADS[index] != null && LOADS[index].isDone()) {
			for (int face = 0; face < 6; face++) {
				MinecraftClient.getInstance().getTextureManager().destroyTexture(Identifier.of("agonmenu", path(index) + "_" + face + ".png"));
			}
			CUBE_MAPS[index] = null;
			LOADS[index] = null;
		}
	}

	private static void load(int index) {
		if (LOADS[index] == null) {
			CUBE_MAPS[index] = new CubeMapRenderer(Identifier.of("agonmenu", path(index)));
			LOADS[index] = CUBE_MAPS[index].loadTexturesAsync(MinecraftClient.getInstance().getTextureManager(), Util.getMainWorkerExecutor());
		}
	}

	private static String path(int index) {
		return "textures/gui/panorama/" + NAMES[index] + "/panorama";
	}
}
