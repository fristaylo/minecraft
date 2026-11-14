package com.wdiscute.starcatcher.lib.multiblock.blockentities;

import com.wdiscute.starcatcher.lib.multiblock.CommonRegistration;
import net.minecraft.core.BlockPos;
import net.minecraft.world.level.block.state.BlockState;

public class SimpleMultiBlockEntity extends AbstractMultiBlockEntity {
    public SimpleMultiBlockEntity(BlockPos pos, BlockState state) {
        super(CommonRegistration.SIMPLE_MULTIBLOCK_ENTITY, pos, state);
    }
}
