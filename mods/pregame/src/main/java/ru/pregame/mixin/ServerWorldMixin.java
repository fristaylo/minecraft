package ru.pregame.mixin;

import net.minecraft.server.world.ServerWorld;
import net.minecraft.world.chunk.WorldChunk;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import ru.pregame.server.Lobby;

@Mixin(ServerWorld.class)
public abstract class ServerWorldMixin {
	@Inject(method = "tickChunk", at = @At("HEAD"), cancellable = true)
	private void pregame$skipLobbyChunkTick(WorldChunk chunk, int randomTickSpeed, CallbackInfo ci) {
		if (Lobby.contains((ServerWorld) (Object) this)) {
			ci.cancel();
		}
	}
}
