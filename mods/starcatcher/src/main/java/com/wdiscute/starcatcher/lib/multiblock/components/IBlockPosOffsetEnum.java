package com.wdiscute.starcatcher.lib.multiblock.components;

import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.world.level.block.Rotation;

import javax.annotation.Nullable;
import java.util.function.Function;

public interface IBlockPosOffsetEnum {

    Function<BlockPos, BlockPos> getOffsetFunction();

    default BlockPos getOffset(){
        return getOffsetFunction().apply(BlockPos.ZERO);
    }

    static <E extends Enum<E> & IBlockPosOffsetEnum> E fromOffset(Class<E> enumClass, BlockPos offset, @Nullable Direction direction, E fallback) {
        for (E part : enumClass.getEnumConstants()) {
            BlockPos testOffset = part.getOffset();
            if (direction != null) {
                testOffset = testOffset.rotate(rotationFromDirection(direction));
            }
            if (testOffset.equals(offset)) {
                return part;
            }
        }
        return fallback;
    }

    static Rotation rotationFromDirection(Direction direction){
        return switch (direction){
            case DOWN, NORTH, UP -> Rotation.NONE;
            case SOUTH -> Rotation.CLOCKWISE_180;
            case WEST -> Rotation.COUNTERCLOCKWISE_90;
            case EAST -> Rotation.CLOCKWISE_90;
        };
    }
}
