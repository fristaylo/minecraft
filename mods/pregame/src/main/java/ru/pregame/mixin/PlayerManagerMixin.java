package ru.pregame.mixin;

import net.minecraft.network.ClientConnection;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.PlayerManager;
import net.minecraft.server.network.ConnectedClientData;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;
import ru.pregame.server.Lobby;
import ru.pregame.server.PregameState;

@Mixin(PlayerManager.class)
public abstract class PlayerManagerMixin {
	@Shadow
	@Final
	private MinecraftServer server;

	@ModifyVariable(method = "onPlayerConnect", at = @At("STORE"), index = 10)
	private ServerWorld pregame$joinInLobby(ServerWorld world, ClientConnection connection, ServerPlayerEntity player, ConnectedClientData clientData) {
		ServerWorld lobby = server.getWorld(Lobby.KEY);
		if (lobby == null || lobby == world || PregameState.get(server).started) {
			return world;
		}
		Lobby.moveToSpawn(player);
		return lobby;
	}
}
