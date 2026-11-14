package com.wdiscute.starcatcher.lib.multiblock.block;

import net.minecraft.core.Direction;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.state.BlockState;

public interface IPreviewableMultiblock extends IMultiBlock {
    default BlockState getDefaultStateForPreviews(Direction direction) {
        BlockState blockState = self().defaultBlockState().setValue(AbstractMultiBlock.CENTER, true);

        if (getDirectionProperty() == null) return blockState;
        return blockState.trySetValue(getDirectionProperty(), direction);
    }

    private Block self(){
        if (this instanceof Block block){
            return block;
        } else {
            throw new RuntimeException(this.getClass().getSimpleName() + " is not implemented on a Block");
        }
    }
}
