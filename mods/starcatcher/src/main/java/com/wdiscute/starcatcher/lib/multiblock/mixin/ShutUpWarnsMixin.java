package com.wdiscute.starcatcher.lib.multiblock.mixin;

import com.llamalad7.mixinextras.sugar.Local;
import com.wdiscute.starcatcher.lib.multiblock.block.IMultiBlock;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.network.ServerGamePacketListenerImpl;
import net.minecraft.world.phys.Vec3;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;

@Mixin(ServerGamePacketListenerImpl.class)
public class ShutUpWarnsMixin {

    @ModifyVariable(method = "handleUseItemOn", at = @At(value = "STORE"), ordinal = 1)
    public Vec3 useAllower(Vec3 vec3, @Local ServerLevel level, @Local BlockPos pos) {
        if(level.getBlockState(pos).getBlock() instanceof IMultiBlock){
            return new Vec3(0, 0 , 0);
        }
        return vec3;
    }
}
