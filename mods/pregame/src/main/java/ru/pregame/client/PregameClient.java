package ru.pregame.client;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.fabricmc.fabric.api.client.screen.v1.ScreenEvents;
import net.fabricmc.fabric.api.client.screen.v1.Screens;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.screen.DownloadingTerrainScreen;
import net.minecraft.client.gui.screen.GameMenuScreen;
import net.minecraft.client.sound.PositionedSoundInstance;
import net.minecraft.sound.SoundEvents;
import net.minecraft.util.Util;
import ru.pregame.network.PhasePayload;
import ru.pregame.network.PhasePayload.Phase;
import ru.pregame.server.Lobby;

public class PregameClient implements ClientModInitializer {
	static Phase phase;
	static int seconds;
	static long phaseTime;
	static boolean pendingWelcome;
	static boolean fromCountdown;
	static long welcomeTime = -1;
	private static int readyTicks;

	@Override
	public void onInitializeClient() {
		ClientPlayNetworking.registerGlobalReceiver(PhasePayload.ID, (payload, context) -> onPhase(context.client(), payload));
		ClientPlayConnectionEvents.DISCONNECT.register((handler, client) -> reset());
		ClientTickEvents.END_CLIENT_TICK.register(PregameClient::tickWelcome);
		HudRenderCallback.EVENT.register(PregameHud::render);
		ScreenEvents.AFTER_INIT.register((client, screen, width, height) -> {
			if (screen instanceof GameMenuScreen menu && menu.shouldShowMenu() && phase == Phase.WAITING && client.player != null && client.player.hasPermissionLevel(2)) {
				Screens.getButtons(screen).add(new StartButton(client, width));
			}
		});
	}

	static boolean inLobby(MinecraftClient client) {
		return client.world != null && Lobby.contains(client.world);
	}

	private static void onPhase(MinecraftClient client, PhasePayload payload) {
		Phase previous = phase;
		phase = payload.phase();
		seconds = payload.seconds();
		phaseTime = Util.getMeasuringTimeMs();
		switch (phase) {
			case WAITING -> {
				pendingWelcome = false;
				fromCountdown = false;
			}
			case COUNTDOWN -> client.getSoundManager().play(PositionedSoundInstance.master(SoundEvents.BLOCK_NOTE_BLOCK_HAT, seconds == 1 ? 1.6F : 1.0F));
			case STARTED -> {
				pendingWelcome = payload.welcome();
				fromCountdown = pendingWelcome && previous == Phase.COUNTDOWN;
				readyTicks = 0;
			}
		}
	}

	private static void tickWelcome(MinecraftClient client) {
		if (!pendingWelcome) {
			return;
		}
		boolean ready = client.world != null && client.player != null && !inLobby(client)
			&& !(client.currentScreen instanceof DownloadingTerrainScreen)
			&& client.world.getChunkManager().isChunkLoaded(client.player.getChunkPos().x, client.player.getChunkPos().z);
		readyTicks = ready ? readyTicks + 1 : 0;
		if (readyTicks >= 20) {
			pendingWelcome = false;
			fromCountdown = false;
			welcomeTime = Util.getMeasuringTimeMs();
			client.getSoundManager().play(PositionedSoundInstance.master(SoundEvents.UI_TOAST_CHALLENGE_COMPLETE, 1.0F));
		}
	}

	private static void reset() {
		phase = null;
		pendingWelcome = false;
		fromCountdown = false;
		welcomeTime = -1;
		readyTicks = 0;
	}
}
