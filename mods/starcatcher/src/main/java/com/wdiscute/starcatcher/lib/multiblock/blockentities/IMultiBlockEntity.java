package com.wdiscute.starcatcher.lib.multiblock.blockentities;

import net.minecraft.core.BlockPos;
import net.minecraft.world.level.LevelReader;
import net.minecraft.world.level.block.entity.BlockEntity;

import java.util.List;

public interface IMultiBlockEntity {
    BlockPos getOffset();
    void setOffset(BlockPos offset);

    boolean isPlaced();
    void setPlaced(boolean placed);

    List<BlockPos> getFullBlockShapeCache();
    void setFullBlockShapeCache(List<BlockPos> shapeCache);

    static void setPlaced(LevelReader level, BlockPos blockPos, boolean placed) {
        if(level.getBlockEntity(blockPos) instanceof IMultiBlockEntity entity) entity.setPlaced(placed);
    }

    static boolean isPlaced(LevelReader level, BlockPos blockPos) {
        if(level.getBlockEntity(blockPos) instanceof IMultiBlockEntity entity) return entity.isPlaced();
        return false;
    }

    default boolean isCenter(){
        return getOffset().equals(new BlockPos(0,0,0));
    }

    default void setCenter(BlockPos center){
       setOffset(getBlockEntity().getBlockPos().subtract(center));
    }

    default BlockPos getCenter(){
       return getBlockEntity().getBlockPos().subtract(getOffset());
    }

    default BlockEntity getBlockEntity(){
        if (this instanceof BlockEntity entity){
            return entity;
        } else {
            throw new RuntimeException(this.getClass().getSimpleName() + " is not implemented on a BlockEntity");
        }
    }
}
