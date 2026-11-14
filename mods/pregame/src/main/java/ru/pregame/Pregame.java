package ru.pregame;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.networking.v1.PayloadTypeRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import ru.pregame.network.PhasePayload;
import ru.pregame.network.StartGamePayload;
import ru.pregame.server.GameFlow;
import ru.pregame.server.Lobby;

public class Pregame implements ModInitializer {
	public static final String MOD_ID = "pregame";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	@Override
	public void onInitialize() {
		PayloadTypeRegistry.playC2S().register(StartGamePayload.ID, StartGamePayload.CODEC);
		PayloadTypeRegistry.playS2C().register(PhasePayload.ID, PhasePayload.CODEC);
		Lobby.init();
		GameFlow.init();
	}
}
