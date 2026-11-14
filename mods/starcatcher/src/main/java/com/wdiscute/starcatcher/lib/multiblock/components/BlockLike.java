package com.wdiscute.starcatcher.lib.multiblock.components;

import net.minecraft.core.BlockPos;
import net.minecraft.world.level.block.state.BlockState;

public class BlockLike {
    public BlockPos pos;
    public BlockState state;

    public BlockLike(BlockPos pos, BlockState state) {
        this.pos = pos;
        this.state = state;
    }
}
