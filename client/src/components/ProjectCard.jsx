import { Link } from 'react-router-dom';
import Avatar from './Avatar';
import { ArrowRight, CheckSquare, Folder, Users } from './Icons';

export default function ProjectCard({ project }) {
  const pct = project.taskCount ? Math.round((project.doneTaskCount / project.taskCount) * 100) : 0;

  return (
    <Link
      to={`/projects/${project.id}`}
      className="project-card"
      style={{ '--project-color': project.color || 'var(--accent)' }}
    >
      <div className="project-card-head">
        <span className="project-icon">
          <Folder size={18} />
        </span>
        <div className="project-card-title">
          <h3>{project.name}</h3>
          <span className="muted small-text">Owner · {project.owner?.displayName || 'Unknown'}</span>
        </div>
        <span className="role-pill">{project.role}</span>
      </div>

      <p className="muted clamp">{project.description || 'No description'}</p>

      <div className="project-progress-head">
        <span className="muted small-text">Progress</span>
        <span className="small-text project-pct">{pct}%</span>
      </div>
      <div className="progress">
        <div className="progress-bar" style={{ width: `${pct}%` }} />
      </div>

      <div className="project-card-foot">
        <span className="project-meta">
          <CheckSquare size={14} />
          {project.doneTaskCount}/{project.taskCount}
        </span>
        <span className="project-meta">
          <Users size={14} />
          {project.memberCount}
        </span>
        <span className="project-card-owner">
          <Avatar user={project.owner} size={24} />
        </span>
        <span className="project-open">
          <ArrowRight size={15} />
        </span>
      </div>
    </Link>
  );
}
