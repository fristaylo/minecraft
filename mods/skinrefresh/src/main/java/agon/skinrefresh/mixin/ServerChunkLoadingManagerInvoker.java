package agon.skinrefresh.mixin;

import net.minecraft.entity.Entity;
import net.minecraft.server.world.ServerChunkLoadingManager;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Invoker;

@Mixin(ServerChunkLoadingManager.class)
public interface ServerChunkLoadingManagerInvoker {
	@Invoker("loadEntity")
	void skinrefresh$loadEntity(Entity entity);

	@Invoker("unloadEntity")
	void skinrefresh$unloadEntity(Entity entity);
}
