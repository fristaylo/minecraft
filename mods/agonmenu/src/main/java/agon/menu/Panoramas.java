package agon.menu;

import com.mojang.blaze3d.systems.RenderSystem;
import java.util.concurrent.CompletableFuture;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.CubeMapRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.util.Identifier;
import net.minecraft.util.Util;

public final class Panoramas {
	private static final String[] NAMES = {"tropical", "forest", "sunset_village", "cherry_night", "end_city"};
	private static final long SLOT_MS = 8000;
	private static final long FADE_MS = 1600;
	private static final float DEGREES_PER_SECOND = 2.0F;
	private static final Identifier VIGNETTE = Identifier.of("agonmenu", "textures/gui/vignette.png");
	private static final CubeMapRenderer[] CUBE_MAPS = new CubeMapRenderer[NAMES.length];
	private static final CompletableFuture<?>[] LOADS = new CompletableFuture<?>[NAMES.length];
	private static final long START = Util.getMeasuringTimeMs();
	private static final int FIRST = (int) (START % NAMES.length);

	private Panoramas() {
	}

	public static void render(DrawContext context, int width, int height, float delta) {
		long elapsed = Util.getMeasuringTimeMs() - START;
		int slot = (int) (elapsed / SLOT_MS);
		long phase = elapsed % SLOT_MS;
		int current = (FIRST + slot) % NAMES.length;
		int next = (current + 1) % NAMES.length;
		float yaw = -elapsed / 1000.0F * DEGREES_PER_SECOND;
		float pitch = (float) Math.sin(elapsed / 6000.0) * 5.0F + 25.0F;

		context.fill(0, 0, width, height, 0xFF000000);
		draw(current, pitch, yaw, 1.0F);
		if (phase >= SLOT_MS - FADE_MS) {
			draw(next, pitch, yaw, (phase - (SLOT_MS - FADE_MS)) / (float) FADE_MS);
		} else {
			load(next);
		}
		vignette(context, width, height);
	}

	public static void vignette(DrawContext context, int width, int height) {
		RenderSystem.enableBlend();
		context.drawTexture(VIGNETTE, 0, 0, width, height, 0, 0, 128, 128, 128, 128);
		RenderSystem.disableBlend();
	}

	private static void draw(int index, float pitch, float yaw, float alpha) {
		load(index);
		if (LOADS[index].isDone()) {
			CUBE_MAPS[index].draw(MinecraftClient.getInstance(), pitch, yaw, alpha);
		}
	}

	private static void load(int index) {
		if (LOADS[index] == null) {
			CUBE_MAPS[index] = new CubeMapRenderer(Identifier.of("agonmenu", "textures/gui/panorama/" + NAMES[index] + "/panorama"));
			LOADS[index] = CUBE_MAPS[index].loadTexturesAsync(MinecraftClient.getInstance().getTextureManager(), Util.getMainWorkerExecutor());
		}
	}
}
