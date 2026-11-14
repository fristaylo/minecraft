package com.wdiscute.starcatcher.lib.multiblock.block;

import com.wdiscute.starcatcher.lib.multiblock.CommonRegistration;
import com.wdiscute.starcatcher.lib.multiblock.components.SharedStatePropertiesBuilder;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.context.BlockPlaceContext;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.LevelAccessor;
import net.minecraft.world.level.LevelReader;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.RenderShape;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.StateDefinition;
import net.minecraft.world.level.block.state.properties.BooleanProperty;
import org.jetbrains.annotations.Nullable;

public abstract class AbstractMultiBlock extends Block implements IMultiBlock {
    public static final BooleanProperty CENTER = BooleanProperty.create("center");
    private final SharedStatePropertiesBuilder SHARED_STATE_BUILDER = new SharedStatePropertiesBuilder();

    public AbstractMultiBlock(Properties properties) {
        super(properties);
        if (getDirectionProperty() != null){
            this.registerDefaultState(this.getStateDefinition().any().setValue(CENTER, false).setValue(getDirectionProperty(), Direction.NORTH));
        } else {
            this.registerDefaultState(this.getStateDefinition().any().setValue(CENTER, false));
        }

        if (!hasCustomBE())
            CommonRegistration.SIMPLE_MULTIBLOCK_ENTITY.addSupportedBlock(this);
    }

    @Override
    public SharedStatePropertiesBuilder getSharedStatePropertiesBuilder() {
        return SHARED_STATE_BUILDER;
    }

    @Override
    public @Nullable BlockState getStateForPlacement(BlockPlaceContext context) {
        return getStateForPlacementHelper(context);
    }

    @Override
    public RenderShape getRenderShape(BlockState state) {
        return getMultiblockRenderShape(state, IMultiBlock.isCenter(state));
    }

    public abstract RenderShape getMultiblockRenderShape(BlockState state, boolean isCenter);

    @Override
    protected void createBlockStateDefinition(StateDefinition.Builder<Block, BlockState> builder) {
        super.createBlockStateDefinition(builder);
        builder.add(CENTER);
        if (getDirectionProperty() != null) builder.add(getDirectionProperty());
    }

    @Override
    public void onPlace(BlockState state, Level level, BlockPos pos, BlockState oldState, boolean movedByPiston) {
        super.onPlace(state, level, pos, oldState, movedByPiston);

        onPlaceHelper(state, level, pos, oldState);
    }

    @Override
    public BlockState updateShape(BlockState state, Direction direction, BlockState neighborState, LevelAccessor level, BlockPos pos, BlockPos neighborPos) {
        return updateShapeHelper(state, direction, neighborState, level, pos, neighborPos);
    }

    @Override
    public boolean canSurvive(BlockState state, LevelReader level, BlockPos pos) {
        return canSurviveHelper(state, level, pos);
    }

    @Override
    public BlockState playerWillDestroy(Level level, BlockPos pos, BlockState state, Player player) {
        preventCreativeDrops(player, level, pos);
        return super.playerWillDestroy(level, pos, state, player);
    }

    @Override
    public @Nullable BlockEntity newBlockEntity(BlockPos pos, BlockState state) {
        return CommonRegistration.SIMPLE_MULTIBLOCK_ENTITY.create(pos, state);
    }

    public boolean hasCustomBE(){
        return false;
    }
}
