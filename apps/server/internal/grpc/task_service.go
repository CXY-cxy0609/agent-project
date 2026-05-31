package grpcserver

import (
	"context"

	taskv1 "tutor-server/api/gen/task/v1"
	"tutor-server/internal/service"
)

type TaskRPCService struct {
	taskv1.UnimplementedTaskServiceServer
	taskService *service.TaskService
}

func NewTaskRPCService(taskService *service.TaskService) *TaskRPCService {
	return &TaskRPCService{
		taskService: taskService,
	}
}

func (s *TaskRPCService) CreateTask(
	ctx context.Context,
	req *taskv1.CreateTaskRequest,
) (*taskv1.CreateTaskResponse, error) {
	task, err := s.taskService.Create(ctx, req.GetType(), req.GetTraceId())
	if err != nil {
		return nil, err
	}
	return &taskv1.CreateTaskResponse{
		TaskId:    task.ID,
		Status:    task.Status,
		CreatedAt: task.CreatedAt,
	}, nil
}

func (s *TaskRPCService) GetTask(
	ctx context.Context,
	req *taskv1.GetTaskRequest,
) (*taskv1.GetTaskResponse, error) {
	task, err := s.taskService.GetByID(ctx, req.GetTaskId())
	if err != nil {
		return nil, err
	}
	return &taskv1.GetTaskResponse{
		TaskId:    task.ID,
		Type:      task.Type,
		Status:    task.Status,
		TraceId:   task.TraceID,
		CreatedAt: task.CreatedAt,
	}, nil
}
