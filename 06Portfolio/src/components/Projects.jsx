import React from 'react';
import { 
  Typography, 
  Container, 
  Grid, 
  Card, 
  CardContent, 
  CardMedia, 
  Button, 
  Chip, 
  Box,
  Avatar,
  IconButton
} from '@mui/material';
import { 
  GitHub as GitHubIcon, 
  Launch as LaunchIcon,
  Work as WorkIcon,
  Star as StarIcon,
  Visibility as VisibilityIcon,
  Code as CodeIcon,
  ArrowForward as ArrowForwardIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';

const Projects = () => {
  const projects = [
    {
      title: 'AI-Mentor',
      description: 'A full-stack e-commerce solution with React, Node.js, and PostgreSQL. Features include user authentication, payment processing, and admin dashboard.',
      image: 'https://images.pexels.com/photos/230544/pexels-photo-230544.jpeg?auto=compress&cs=tinysrgb&w=800',
      technologies: ['React', 'Node.js', 'Mongodb', 'Mockapi', 'Tailwind Css', 'Material UI'],
      github: 'https://github.com/prat-glitch/AI_MENTOR',
      demo: 'https://aichat-mu-six.vercel.app/',
      category: 'Full Stack',
      status: 'Live',
      color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      featured: true
    },
    {
      title: 'Weather Dashboard',
      description: 'A responsive weather dashboard with location-based forecasts, interactive maps, and detailed weather analytics.',
      image: 'https://images.pexels.com/photos/1118873/pexels-photo-1118873.jpeg?auto=compress&cs=tinysrgb&w=800',
      technologies: ['React', 'Chart.js', 'OpenWeather API', 'Tailwind'],
      github: '#',
      demo: '#',
      category: 'Dashboard',
      status: 'Live',
      color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      featured: false
    },
    {
      title: 'Social Media Analytics',
      description: 'A comprehensive analytics platform for social media management with data visualization and automated reporting.',
      image: 'https://images.pexels.com/photos/265087/pexels-photo-265087.jpeg?auto=compress&cs=tinysrgb&w=800',
      technologies: ['Next.js', 'Python', 'D3.js', 'AWS'],
      github: '#',
      demo: '#',
      category: 'Analytics',
      status: 'Live',
      color: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      featured: true
    },
    {
      title: 'Learning Management System',
      description: 'An educational platform with course management, video streaming, progress tracking, and interactive quizzes.',
      image: 'https://images.pexels.com/photos/159711/books-bookstore-book-reading-159711.jpeg?auto=compress&cs=tinysrgb&w=800',
      technologies: ['React', 'Express.js', 'MongoDB', 'Video.js'],
      github: '#',
      demo: '#',
      category: 'Education',
      status: 'Live',
      color: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      featured: false
    }
  ];

  return (
    <section 
      id="projects" 
      style={{
        background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
        padding: '120px 0',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Background Pattern */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.1) 0%, transparent 50%)',
        pointerEvents: 'none'
      }} />
      
      <Container maxWidth="lg" style={{ position: 'relative', zIndex: 1 }}>
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
          viewport={{ once: true }}
          style={{ textAlign: 'center', marginBottom: '80px' }}
        >
          <motion.div
            initial={{ scale: 0.8 }}
            whileInView={{ scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            style={{ marginBottom: '24px' }}
          >
            <Chip
              icon={<WorkIcon />}
              label="Featured Projects"
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                fontWeight: 600,
                fontSize: '14px',
                padding: '8px 16px',
                height: '40px',
                '& .MuiChip-icon': { color: 'white' }
              }}
            />
          </motion.div>
          
          <Typography 
            variant="h2" 
            sx={{ 
              fontSize: { xs: '2.5rem', md: '3.5rem' },
              fontWeight: 700,
              color: 'white',
              marginBottom: '24px',
              lineHeight: 1.2
            }}
          >
            Featured <span style={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>Projects</span>
          </Typography>
          
          <Typography 
            variant="body1" 
            sx={{ 
              color: '#a1a1aa',
              fontSize: '18px',
              maxWidth: '700px',
              margin: '0 auto',
              lineHeight: 1.6
            }}
          >
            Here are some of my recent projects that showcase my skills and experience in web development. 
            Each project represents a unique challenge and solution.
          </Typography>
        </motion.div>

        {/* Featured Projects */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
          viewport={{ once: true }}
          style={{ marginBottom: '80px' }}
        >
          <Typography 
            variant="h4" 
            sx={{ 
              color: 'white', 
              fontWeight: 700,
              fontSize: '24px',
              marginBottom: '40px',
              textAlign: 'center'
            }}
          >
            Featured Work
          </Typography>
          
          <Grid container spacing={4}>
            {projects.filter(project => project.featured).map((project, index) => (
              <Grid item xs={12} md={6} key={index}>
                <motion.div
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ 
                    duration: 0.8, 
                    delay: index * 0.2,
                    type: "spring",
                    stiffness: 100
                  }}
                  viewport={{ once: true }}
                  whileHover={{ y: -8, scale: 1.02 }}
                >
                  <Card 
                    sx={{
                      height: '100%',
                      background: 'rgba(255, 255, 255, 0.05)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '20px',
                      overflow: 'hidden',
                      position: 'relative',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
                        border: '1px solid rgba(255, 255, 255, 0.2)'
                      }
                    }}
                  >
                    {/* Project Image */}
                    <Box sx={{ position: 'relative', height: '250px', overflow: 'hidden' }}>
                      <CardMedia
                        component="img"
                        image={project.image}
                        alt={project.title}
                        sx={{
                          height: '100%',
                          objectFit: 'cover',
                          transition: 'transform 0.5s ease',
                          '&:hover': {
                            transform: 'scale(1.1)'
                          }
                        }}
                      />
                      {/* Overlay */}
                      <Box sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0,
                        transition: 'opacity 0.3s ease',
                        '&:hover': {
                          opacity: 1
                        }
                      }}>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                          <IconButton
                            href={project.github}
                            sx={{
                              color: 'white',
                              backgroundColor: 'rgba(255, 255, 255, 0.2)',
                              '&:hover': {
                                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                                transform: 'scale(1.1)'
                              }
                            }}
                          >
                            <GitHubIcon />
                          </IconButton>
                          <IconButton
                            href={project.demo}
                            sx={{
                              color: 'white',
                              backgroundColor: 'rgba(255, 255, 255, 0.2)',
                              '&:hover': {
                                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                                transform: 'scale(1.1)'
                              }
                            }}
                          >
                            <LaunchIcon />
                          </IconButton>
                        </Box>
                      </Box>
                      
                      {/* Status Badge */}
                      <Chip
                        label={project.status}
                        size="small"
                        sx={{
                          position: 'absolute',
                          top: 16,
                          right: 16,
                          background: 'rgba(0, 255, 0, 0.2)',
                          color: '#00ff00',
                          fontWeight: 600,
                          fontSize: '11px',
                          border: '1px solid rgba(0, 255, 0, 0.3)'
                        }}
                      />
                    </Box>

                    <CardContent sx={{ padding: '24px' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 2 }}>
                        <Avatar sx={{
                          width: 40,
                          height: 40,
                          background: project.color
                        }}>
                          <CodeIcon />
                        </Avatar>
                        <Box>
                          <Typography 
                            variant="h6" 
                            sx={{ 
                              color: 'white',
                              fontWeight: 700,
                              fontSize: '18px'
                            }}
                          >
                            {project.title}
                          </Typography>
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              color: '#a78bfa',
                              fontWeight: 500,
                              fontSize: '12px'
                            }}
                          >
                            {project.category}
                          </Typography>
                        </Box>
                      </Box>
                      
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: '#a1a1aa',
                          lineHeight: 1.6,
                          fontSize: '14px',
                          marginBottom: 3
                        }}
                      >
                        {project.description}
                      </Typography>
                      
                      <Box sx={{ marginBottom: 3 }}>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {project.technologies.map((tech, techIndex) => (
                            <Chip
                              key={techIndex}
                              label={tech}
                              size="small"
                              sx={{
                                background: 'rgba(255, 255, 255, 0.1)',
                                color: 'white',
                                fontWeight: 500,
                                fontSize: '11px',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                '&:hover': {
                                  background: 'rgba(255, 255, 255, 0.2)'
                                }
                              }}
                            />
                          ))}
                        </Box>
                      </Box>
                      
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                          variant="outlined"
                          startIcon={<GitHubIcon />}
                          href={project.github}
                          sx={{
                            flex: 1,
                            color: 'white',
                            borderColor: 'rgba(255, 255, 255, 0.3)',
                            '&:hover': {
                              borderColor: 'white',
                              backgroundColor: 'rgba(255, 255, 255, 0.1)'
                            }
                          }}
                        >
                          Code
                        </Button>
                        <Button
                          variant="contained"
                          startIcon={<LaunchIcon />}
                          href={project.demo}
                          sx={{
                            flex: 1,
                            background: project.color,
                            '&:hover': {
                              background: project.color,
                              transform: 'translateY(-2px)',
                              boxShadow: '0 8px 25px rgba(0, 0, 0, 0.3)'
                            }
                          }}
                        >
                          Demo
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </motion.div>

        {/* Other Projects */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
          viewport={{ once: true }}
        >
          <Typography 
            variant="h4" 
            sx={{ 
              color: 'white', 
              fontWeight: 700,
              fontSize: '24px',
              marginBottom: '40px',
              textAlign: 'center'
            }}
          >
            Other Projects
          </Typography>
          
          <Grid container spacing={3}>
            {projects.filter(project => !project.featured).map((project, index) => (
              <Grid item xs={12} md={6} lg={4} key={index}>
                <motion.div
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ 
                    duration: 0.8, 
                    delay: index * 0.1,
                    type: "spring",
                    stiffness: 100
                  }}
                  viewport={{ once: true }}
                  whileHover={{ y: -8, scale: 1.02 }}
                >
                  <Card 
                    sx={{
                      height: '100%',
                      background: 'rgba(255, 255, 255, 0.05)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '16px',
                      overflow: 'hidden',
                      position: 'relative',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        boxShadow: '0 15px 30px rgba(0, 0, 0, 0.3)',
                        border: '1px solid rgba(255, 255, 255, 0.2)'
                      }
                    }}
                  >
                    <Box sx={{ position: 'relative', height: '200px', overflow: 'hidden' }}>
                      <CardMedia
                        component="img"
                        image={project.image}
                        alt={project.title}
                        sx={{
                          height: '100%',
                          objectFit: 'cover',
                          transition: 'transform 0.5s ease',
                          '&:hover': {
                            transform: 'scale(1.05)'
                          }
                        }}
                      />
                      <Box sx={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        background: project.color,
                        borderRadius: '8px',
                        padding: '4px 8px'
                      }}>
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '10px'
                          }}
                        >
                          {project.category}
                        </Typography>
                      </Box>
                    </Box>

                    <CardContent sx={{ padding: '20px' }}>
                      <Typography 
                        variant="h6" 
                        sx={{ 
                          color: 'white',
                          fontWeight: 600,
                          fontSize: '16px',
                          marginBottom: 1
                        }}
                      >
                        {project.title}
                      </Typography>
                      
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: '#a1a1aa',
                          lineHeight: 1.5,
                          fontSize: '13px',
                          marginBottom: 2
                        }}
                      >
                        {project.description}
                      </Typography>
                      
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, marginBottom: 2 }}>
                        {project.technologies.slice(0, 3).map((tech, techIndex) => (
                          <Chip
                            key={techIndex}
                            label={tech}
                            size="small"
                            sx={{
                              background: 'rgba(255, 255, 255, 0.1)',
                              color: 'white',
                              fontWeight: 500,
                              fontSize: '10px',
                              height: '20px'
                            }}
                          />
                        ))}
                        {project.technologies.length > 3 && (
                          <Chip
                            label={`+${project.technologies.length - 3}`}
                            size="small"
                            sx={{
                              background: 'rgba(255, 255, 255, 0.1)',
                              color: 'white',
                              fontWeight: 500,
                              fontSize: '10px',
                              height: '20px'
                            }}
                          />
                        )}
                      </Box>
                      
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton
                          href={project.github}
                          size="small"
                          sx={{
                            color: 'white',
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            '&:hover': {
                              backgroundColor: 'rgba(255, 255, 255, 0.2)'
                            }
                          }}
                        >
                          <GitHubIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                        <IconButton
                          href={project.demo}
                          size="small"
                          sx={{
                            color: 'white',
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            '&:hover': {
                              backgroundColor: 'rgba(255, 255, 255, 0.2)'
                            }
                          }}
                        >
                          <LaunchIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Box>
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </motion.div>
      </Container>
    </section>
  );
};

export default Projects;
